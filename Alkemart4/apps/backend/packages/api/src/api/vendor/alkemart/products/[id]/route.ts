import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, MedusaError } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import { updateOffersWorkflow } from "@mercurjs/core/workflows"
import { checkRateLimit } from "../../../../../lib/simple-rate-limit.ts"
import { asList } from "../../../../../lib/graph-utils.ts"
import { logger } from "../../../../../lib/logger.ts"
import { invalidateSellerOwnedProductIds } from "../../../../../lib/seller-owned-products-cache.ts"
import { z } from "zod"
import { buildOfferPriceUpdates, type OfferRow } from "../../../../../lib/offer-pricing.ts"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
  session?: { seller_id?: string }
}

function sellerId(req: SellerReq): string {
  return (
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    (typeof req.get === "function" ? req.get("x-seller-id") : "") ||
    ""
  )
}

async function verifyOwnership(
  query: { graph: (args: unknown) => Promise<{ data: unknown }> },
  productId: string,
  sid: string,
): Promise<boolean> {
  const { data } = await query.graph({
    entity: "product_seller",
    fields: ["product_id"],
    filters: { product_id: productId, seller_id: sid },
  })
  return Array.isArray(data) && data.length > 0
}

const DETAIL_FIELDS = [
  "id",
  "title",
  "handle",
  "status",
  "thumbnail",
  "description",
  "metadata",
  "created_at",
  "updated_at",
  "categories.id",
  "categories.name",
  "categories.handle",
  "images.url",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.prices.amount",
  "variants.prices.currency_code",
]

export async function GET(req: SellerReq, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "Product id required" })
    return
  }

  const sid = sellerId(req)
  if (!sid) {
    res.status(400).json({ error: "Seller context required" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const owned = await verifyOwnership(query, productId, sid)
    if (!owned) {
      res.status(403).json({ error: "Product not found or not yours" })
      return
    }

    const { data } = await query.graph({
      entity: "product",
      fields: DETAIL_FIELDS,
      filters: { id: productId },
    })
    const product = asList(data)[0]
    if (!product) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    res.status(200).json({ product })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to load product",
    })
  }
}

export async function PUT(req: SellerReq, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "Product id required" })
    return
  }

  const sid = sellerId(req)
  if (!sid) {
    res.status(400).json({ error: "Seller context required" })
    return
  }

  const { ok } = checkRateLimit({ key: `product-update:${sid}`, limit: 30, windowMs: 60_000 })
  if (!ok) {
    return res.status(429).json({ error: "Too many updates. Please wait before retrying." })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const owned = await verifyOwnership(query, productId, sid)
    if (!owned) {
      res.status(403).json({ error: "Product not found or not yours" })
      return
    }

    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "status", "metadata"],
      filters: { id: productId },
    })
    const existing = asList(data)[0]
    if (!existing) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    const status = String(existing.status || "").toLowerCase()
    if (status === "published") {
      res.status(409).json({
        error: "Published products cannot be edited while live.",
        next_action: {
          unpublish: `POST /vendor/alkemart/products/${productId}/unpublish`,
          message:
            "Unpublish the product first (returns it to proposed), then edit and re-propose for admin re-approval.",
        },
      })
      return
    }

    const body = (req.body || {}) as Record<string, unknown>
    const update: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const t = String(body.title).trim()
      if (t.length < 3) {
        res.status(400).json({ error: "Title must be at least 3 characters." })
        return
      }
      update.title = t
    }
    if (body.description !== undefined) {
      update.description = String(body.description).trim() || undefined
    }
    if (body.thumbnail !== undefined) {
      const raw = String(body.thumbnail).trim()
      if (raw) {
        const parsed = z.string().url().safeParse(raw)
        if (!parsed.success) {
          throw new MedusaError(MedusaError.Types.INVALID_DATA, `Invalid thumbnail URL: ${raw}`)
        }
      }
      update.thumbnail = raw || undefined
    }
    if (body.categories !== undefined) {
      const raw = body.categories
      if (!Array.isArray(raw)) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid categories: expected an array")
      }
      const parsed = z.array(z.string().or(z.object({ id: z.string() }))).safeParse(raw)
      if (!parsed.success) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid categories: expected array of category IDs or { id } objects")
      }
      update.categories = raw.map((c: unknown) =>
        typeof c === "string" ? { id: c } : c,
      )
    }

    if (body.seo !== undefined) {
      const parsed = z.record(z.string()).safeParse(body.seo)
      if (!parsed.success) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Invalid seo: expected an object of string fields.",
        )
      }
      const meta = (existing?.metadata as Record<string, unknown>) || {}
      const alk =
        meta.alkemart && typeof meta.alkemart === "object"
          ? { ...(meta.alkemart as Record<string, unknown>) }
          : {}
      alk.seo = parsed.data
      update.metadata = { ...meta, alkemart: { ...alk } }
    }

    let variantsEdited = false
    if (body.variants !== undefined) {
      variantsEdited = true
      if (!Array.isArray(body.variants)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Invalid variants: expected an array",
        )
      }
      const parsed = z
        .array(
          z.object({
            id: z.string(),
            price_ghs: z.union([z.number(), z.string()]).optional(),
          }),
        )
        .safeParse(body.variants)
      if (!parsed.success) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Invalid variants: each must be { id: string, price_ghs?: number|string }",
        )
      }

      // ownership-safe: edited variant ids must belong to this owned product
      const { data: varData } = await query.graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { id: productId },
      })
      const productRow = asList(varData)[0] as
        | { variants?: Array<{ id: string }> }
        | undefined
      const ownedVariants = new Set(productRow?.variants?.map((v) => v.id) ?? [])
      const edits = parsed.data.filter((e) => ownedVariants.has(e.id))
      if (edits.length !== parsed.data.length) {
        res
          .status(403)
          .json({ error: "One or more variants do not belong to this product." })
        return
      }

      // map variant_id -> owned offer + price row, then build price upserts
      const { data: offerData } = await query.graph({
        entity: "offer",
        fields: ["id", "variant_id", "prices.id", "prices.amount", "prices.currency_code"],
        filters: { seller_id: sid },
      })
      const { updates, unmatched, invalid } = buildOfferPriceUpdates(
        edits,
        asList(offerData) as unknown as OfferRow[],
      )
      if (invalid.length > 0) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid price for variant(s): ${invalid.join(", ")}. Minimum is GH₵0.50.`,
        )
      }
      if (unmatched.length > 0) {
        res
          .status(403)
          .json({ error: `No owned offer for variant(s): ${unmatched.join(", ")}` })
        return
      }

      if (updates.length > 0) {
        // seller_id is required by updateOffersWorkflow's validate hook (readiness);
        // the offer rows themselves are already owned by this seller.
        const offers = updates.map((u) => ({ ...u, seller_id: sid }))
        await updateOffersWorkflow(req.scope).run({ input: { offers } })
      }
    }

    if (Object.keys(update).length === 0 && !variantsEdited) {
      res.status(400).json({ error: "No fields to update." })
      return
    }

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      updateProducts: (
        id: string,
        data: Record<string, unknown>,
      ) => Promise<unknown>
    }

    await productModule.updateProducts(productId, update)

    const { data: refreshed } = await query.graph({
      entity: "product",
      fields: DETAIL_FIELDS,
      filters: { id: productId },
    })
    const product = asList(refreshed)[0]

    res.status(200).json({
      product,
      message: "Product updated.",
    })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to update product",
    })
  }
}

export async function DELETE(req: SellerReq, res: MedusaResponse) {
  const productId = req.params.id
  if (!productId) {
    res.status(400).json({ error: "Product id required" })
    return
  }

  const sid = sellerId(req)
  if (!sid) {
    res.status(400).json({ error: "Seller context required" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  try {
    const owned = await verifyOwnership(query, productId, sid)
    if (!owned) {
      res.status(403).json({ error: "Product not found or not yours" })
      return
    }

    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "status"],
      filters: { id: productId },
    })
    const existing = asList(data)[0]
    if (!existing) {
      res.status(404).json({ error: "Product not found" })
      return
    }

    const status = String(existing.status || "").toLowerCase()
    if (status === "published") {
      res.status(409).json({
        error: "Published products cannot be deleted while live.",
        next_action: {
          unpublish: `POST /vendor/alkemart/products/${productId}/unpublish`,
          message:
            "Unpublish the product first (returns it to proposed), then delete.",
        },
      })
      return
    }

    // Delete associated offers first
    try {
      const { data: productDetail } = await query.graph({
        entity: "product",
        fields: ["id", "variants.id"],
        filters: { id: productId },
      })
      const prodList = asList(productDetail) as Array<Record<string, unknown>>
      const deleteProduct = prodList[0]
      const productVariants = (deleteProduct?.variants ?? []) as Array<{ id: string }>

      const { data: offerData } = await query.graph({
        entity: "offer",
        fields: ["id", "variant_id"],
        filters: { product_id: productId },
      })
      const variantIds = new Set(productVariants.map((v) => v.id))
      const offersToDelete = asList(offerData).filter(
        (o: Record<string, unknown>) => variantIds.has(String(o.variant_id ?? "")),
      )
      const offerModule = req.scope.resolve(MercurModules.OFFER) as
        | { deleteOffers?: (ids: string[]) => Promise<unknown> }
        | undefined
      if (offerModule?.deleteOffers && offersToDelete.length) {
        await offerModule.deleteOffers(offersToDelete.map((o: Record<string, unknown>) => o.id as string))
      }
    } catch (e) {
      logger.error("[alkemart] delete: offer cleanup failed", { error: e instanceof Error ? e.message : e })
    }

    const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as {
      dismiss: (data: unknown) => Promise<unknown>
    }

    try {
      await link.dismiss({
        [Modules.PRODUCT]: { product_id: productId },
        [MercurModules.SELLER]: { seller_id: sid },
      })
    } catch (linkErr) {
      logger.error("[alkemart] delete: link.dismiss failed — product was already deleted, link may be orphaned", { error: linkErr instanceof Error ? linkErr.message : linkErr })
    }

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      deleteProducts: (ids: string[]) => Promise<unknown>
    }
    await productModule.deleteProducts([productId])

    void invalidateSellerOwnedProductIds(sid).catch(() => {})

    res.status(200).json({ success: true, message: "Product deleted." })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to delete product",
    })
  }
}
