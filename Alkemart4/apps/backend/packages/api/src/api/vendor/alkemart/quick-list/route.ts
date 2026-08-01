/**
 * POST /vendor/alkemart/quick-list
 * One-step product listing for Ghana sellers: title + price + photo → proposed.
 *
 * Canonical Mercur flow in a single call:
 *   1. createProductsWorkflow — master product with variant-axis attributes
 *      (Color, Size, Pack, …) and a variant per combination.
 *   2. createOffersWorkflow — one offer per variant, each with its own price
 *      (per-variant override, defaulting to the base price) and its own stock.
 *
 * Seller may omit variants entirely → a single default variant (base price +
 * base quantity). Any failure cleans up the created product + seller link.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, MedusaError } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import {
  createOffersWorkflow,
  createProductsWorkflow,
} from "@mercurjs/core/workflows"
import { evaluateSellerReadiness } from "../../../../lib/seller-readiness"
import { invalidateSellerOwnedProductIds } from "../../../../lib/seller-owned-products-cache"
import { checkRateLimit } from "../../../../lib/rate-limiter"
import { asList } from "../../../../lib/graph-utils"
import { z } from "zod"
import { logger } from "../../../../lib/logger"

const MAX_AXES = 3
const MAX_COMBOS = 40

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string; member_id?: string }
  session?: { seller_id?: string }
}

type VariantAxis = { name: string; values: string[] }
type VariantEntry = {
  options: Record<string, string>
  price_ghs?: number
  quantity?: number
}

function parseVariantAxes(body: Record<string, unknown>): VariantAxis[] {
  const raw = body.variant_options
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "variant_options must be an array.")
  }

  const out: VariantAxis[] = []
  for (const item of raw) {
    const rec = item as Record<string, unknown>
    const name = String(rec.name || "").trim()
    const rawValues = rec.values
    const values = Array.isArray(rawValues)
      ? rawValues.map((v) => String(v).trim()).filter(Boolean)
      : typeof rawValues === "string"
        ? rawValues.split(",").map((v) => v.trim()).filter(Boolean)
        : []
    if (name && values.length > 0) {
      out.push({ name, values })
    }
  }

  if (out.length > MAX_AXES) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `At most ${MAX_AXES} variation types.`)
  }
  const combos = out.reduce((acc, o) => acc * o.values.length, 1)
  if (combos > MAX_COMBOS) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Too many variations. Keep combinations under ${MAX_COMBOS}.`,
    )
  }
  return out
}

function parseVariantEntries(body: Record<string, unknown>): VariantEntry[] {
  const raw = body.variant_entries
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "variant_entries must be an array.")
  }

  const out: VariantEntry[] = []
  for (const item of raw) {
    const rec = item as Record<string, unknown>
    const options = (rec.options ?? {}) as Record<string, unknown>
    const normalized: Record<string, string> = {}
    for (const [key, value] of Object.entries(options)) {
      const k = String(key).trim()
      const v = String(value ?? "").trim()
      if (k && v) normalized[k] = v
    }
    if (Object.keys(normalized).length === 0) continue

    const entry: VariantEntry = { options: normalized }

    if (rec.price_ghs !== undefined && rec.price_ghs !== null && rec.price_ghs !== "") {
      const p = Number(rec.price_ghs)
      if (!Number.isFinite(p) || p < 0.5) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid price for ${Object.values(normalized).join(" / ")}.`,
        )
      }
      if (p > 500_000) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Price for ${Object.values(normalized).join(" / ")} must not exceed GH₵500,000.`,
        )
      }
      entry.price_ghs = p
    }

    if (rec.quantity !== undefined && rec.quantity !== null && rec.quantity !== "") {
      const q = Math.floor(Number(rec.quantity))
      if (!Number.isFinite(q) || q < 1) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid quantity for ${Object.values(normalized).join(" / ")}.`,
        )
      }
      entry.quantity = q
    }

    out.push(entry)
  }
  return out
}

function cartesian<T extends Record<string, unknown>>(lists: T[][]): T[] {
  return lists.reduce<T[]>((acc, list) => {
    if (acc.length === 0) return list
    return acc.flatMap((a) => list.map((b) => ({ ...a, ...b })))
  }, [])
}

function comboKey(options: Record<string, string>): string {
  return JSON.stringify(Object.entries(options).sort(([a], [b]) => a.localeCompare(b)))
}

export async function POST(req: SellerReq, res: MedusaResponse) {
  const sellerId =
    req.seller_context?.seller_id ||
    req.session?.seller_id ||
    ""

  if (!sellerId) {
    res.status(400).json({ error: "Select your shop first, then try again." })
    return
  }

  const allowed = await checkRateLimit(`ql:${sellerId}`, 10, 60_000)
  if (!allowed) {
    res.status(429).json({ error: "Too many requests. Please wait and try again." })
    return
  }

  const body = (req.body || {}) as Record<string, unknown>
  const title = String(body.title || "").trim()

  const rawPrice = body.price_ghs
  const basePrice = (() => {
    const parsed = Number(rawPrice)
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Invalid price: ${rawPrice}`)
    }
    return parsed
  })()

  const description = String(body.description || "").trim()
  const category_id = String(body.category_id || "").trim() || undefined
  const image_url = String(body.image_url || "").trim() || undefined
  if (image_url !== undefined && image_url !== '' && image_url !== null) {
    const parsed = z.string().url().safeParse(image_url)
    if (!parsed.success) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Invalid image URL: ${image_url}`)
    }
  }
  const baseQuantity = Math.max(1, Math.floor(Number(body.quantity) || 1))
  const variantAxes = parseVariantAxes(body)
  const variantEntries = parseVariantEntries(body)

  if (!title || title.length < 3) {
    res.status(400).json({ error: "Title must be at least 3 characters." })
    return
  }
  if (basePrice < 0.5) {
    res.status(400).json({ error: "Price must be at least GH₵0.50." })
    return
  }
  if (basePrice > 500_000) {
    res.status(400).json({ error: "Price must not exceed GH₵500,000." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  let createdProductId: string | null = null

  try {
    const readiness = await evaluateSellerReadiness(query, sellerId)
    if (!readiness) {
      res.status(404).json({ error: "Seller not found." })
      return
    }

    if (readiness.mercur_status !== "open") {
      const msg =
        readiness.mercur_status === "pending_approval"
          ? "Your shop is under review. You can list once approved."
          : readiness.mercur_status === "suspended"
            ? "Your shop is paused. Contact support to reopen."
            : "Cannot list products."
      res.status(403).json({ error: msg, readiness })
      return
    }

    if (readiness.phase === "setup_incomplete") {
      res.status(400).json({
        error: "Set your pack address first (Settings → Dispatch Address).",
        readiness,
      })
      return
    }

    const { data: sellerData } = await query.graph({
      entity: "seller",
      fields: [
        "id",
        "stock_locations.id",
        "stock_locations.name",
        "shipping_profiles.id",
        "shipping_profiles.name",
      ],
      filters: { id: sellerId },
    })
    const seller = asList(sellerData)[0] as Record<string, unknown> | undefined
    const stockLocations = (seller?.stock_locations || []) as Array<{ id: string }>
    const shippingProfiles = (seller?.shipping_profiles || []) as Array<{ id: string }>
    const stockLocationId = stockLocations[0]?.id
    const shippingProfileId = shippingProfiles[0]?.id

    if (!stockLocationId || !shippingProfileId) {
      res.status(400).json({
        error: "Set your pack address first (Settings → Dispatch Address).",
      })
      return
    }

    const memberId = req.seller_context?.member_id || sellerId

    const attributes = variantAxes.map((o) => ({
      title: o.name,
      values: o.values,
      is_variant_axis: true,
    }))

    // One entry per combination; missing entries fall back to base price/quantity.
    const combos = variantAxes.length
      ? cartesian(variantAxes.map((o) => o.values.map((v) => ({ [o.name]: v }))))
      : [{}]
    const entriesByKey = new Map(
      variantEntries.map((e) => [comboKey(e.options), e]),
    )
    const variantSpecs = combos.map((combo) => {
      const options = combo as Record<string, string>
      const key = comboKey(options)
      const entry = entriesByKey.get(key)
      return {
        title: Object.keys(options).length ? Object.values(options).join(" / ") : "Default",
        options,
        price_ghs: entry?.price_ghs ?? basePrice,
        quantity: entry?.quantity ?? baseQuantity,
      }
    })

    const { result: createdProducts } = await createProductsWorkflow(
      req.scope,
    ).run({
      input: {
        created_by: memberId,
        products: [{
          title,
          description: description || undefined,
          thumbnail: image_url || undefined,
          category_ids: category_id ? [category_id] : undefined,
          status: "proposed",
          seller_ids: [sellerId],
          attributes: attributes.length ? attributes : undefined,
          variants: variantSpecs.map((s) => ({
            title: s.title,
            options: s.options,
          })),
          metadata: { alkemart: { origin: "quick-list", price_ghs: basePrice } },
        }],
      },
    })
    const product = asList(createdProducts)[0] as Record<string, unknown> | undefined

    if (!product?.id) {
      res.status(500).json({ error: "Product creation failed." })
      return
    }
    createdProductId = product.id as string
    void invalidateSellerOwnedProductIds(sellerId).catch(() => {})

    let productVariants = Array.isArray(product.variants)
      ? (product.variants as Array<{ id: string }>)
      : []
    if (productVariants.length === 0) {
      const { data: productData } = await query.graph({
        entity: "product",
        fields: ["id", "variants.id"],
        filters: { id: product.id },
      })
      const prodRow = asList(productData)[0] as Record<string, unknown> | undefined
      productVariants = ((prodRow?.variants || []) as Array<{ id: string }>)
    }

    if (productVariants.length === 0) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Product was created without a variant — cannot attach price or stock.",
      )
    }

    // Offers are indexed 1:1 with the requested variant specs.
    const offers = productVariants.map((variant, i) => {
      const spec = variantSpecs[i] ?? { price_ghs: basePrice, quantity: baseQuantity }
      const offerSku = `QL-${String(product.id).slice(0, 8)}-${i + 1}`
      return {
        seller_id: sellerId,
        created_by: memberId,
        variant_id: variant.id,
        shipping_profile_id: shippingProfileId,
        sku: offerSku,
        inventory_items: [{
          sku: offerSku,
          stock_levels: [{
            location_id: stockLocationId,
            stocked_quantity: spec.quantity,
          }],
        }],
        prices: [{ amount: spec.price_ghs, currency_code: "ghs" }],
      }
    })
    await createOffersWorkflow(req.scope).run({ input: { offers } })

    const variantsSummary = productVariants.map((variant, i) => {
      const spec = variantSpecs[i] ?? { price_ghs: basePrice, quantity: baseQuantity }
      return {
        variant_id: variant.id,
        title: spec.title,
        price_ghs: spec.price_ghs,
        quantity: spec.quantity,
      }
    })

    res.status(201).json({
      product_id: product.id,
      status: "proposed",
      variant_count: variantsSummary.length,
      variants: variantsSummary,
      message:
        variantsSummary.length === 1
          ? "Listed for review. We'll check it shortly."
          : `Listed ${variantsSummary.length} variations for review. We'll check it shortly.`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Quick list failed"
    logger.error("[alkemart] quick-list error", { sellerId, error: msg })

    // Clean up partial state (product + seller link only if offer step failed)
    if (createdProductId) {
      try {
        const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as {
          dismiss: (data: unknown) => Promise<unknown>
        }
        await link.dismiss({
          [Modules.PRODUCT]: { product_id: createdProductId },
          [MercurModules.SELLER]: { seller_id: sellerId },
        }).catch(() => {})
        const pm = req.scope.resolve(Modules.PRODUCT) as {
          deleteProducts?: (ids: string[]) => Promise<unknown>
        }
        if (pm.deleteProducts) {
          await pm.deleteProducts([createdProductId])
        }
      } catch (cleanupErr) {
        logger.error("[alkemart] quick-list cleanup failed for product", { productId: createdProductId, error: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr })
      }
    }

    res.status(500).json({ error: msg })
  }
}
