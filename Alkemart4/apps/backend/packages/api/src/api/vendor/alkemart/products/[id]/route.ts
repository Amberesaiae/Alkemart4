import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MercurModules } from "@mercurjs/types"
import { asList } from "../../../../../lib/graph-utils"

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
      res.status(400).json({ error: "Cannot edit a published product. Contact support." })
      return
    }
    if (status === "rejected") {
      res.status(400).json({ error: "Cannot edit a rejected product. Create a new listing." })
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
      update.thumbnail = String(body.thumbnail).trim() || undefined
    }
    if (body.categories !== undefined) {
      const cats = Array.isArray(body.categories) ? body.categories : []
      update.categories = cats.map((c: unknown) =>
        typeof c === "string" ? { id: c } : c,
      )
    }

    if (Object.keys(update).length === 0) {
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
      res.status(400).json({ error: "Cannot delete a published product. Contact support." })
      return
    }

    const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as {
      dismiss: (data: unknown) => Promise<unknown>
    }

    await link.dismiss({
      [Modules.PRODUCT]: { product_id: productId },
      [MercurModules.SELLER]: { seller_id: sid },
    }).catch(() => {})

    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      deleteProducts: (ids: string[]) => Promise<unknown>
    }
    await productModule.deleteProducts([productId])

    res.status(200).json({ success: true, message: "Product deleted." })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to delete product",
    })
  }
}
