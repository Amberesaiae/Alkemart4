/**
 * GET /vendor/alkemart/products
 *
 * Lightweight exclusive product list for Seller Hub.
 * Bypasses Mercur GET /vendor/products (heavy graph + shared-catalog filter).
 *
 * Ownership: product_seller only (same exclusive rule as strict middleware).
 * Fields: id, title, handle, status, thumbnail — enough for list UI.
 *
 * Query: limit (default 50, max 100), offset (default 0)
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  getCachedOwnedProductIds,
  setCachedOwnedProductIds,
} from "../../../../lib/seller-owned-products-cache"

type SellerReq = MedusaRequest & {
  seller_context?: { seller_id?: string }
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

function parseLimitOffset(q: Record<string, unknown> | undefined) {
  const limitRaw = Number(q?.limit ?? 50)
  const offsetRaw = Number(q?.offset ?? 0)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : 50
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.floor(offsetRaw))
    : 0
  return { limit, offset }
}

export async function GET(req: SellerReq, res: MedusaResponse) {
  const sellerId =
    req.seller_context?.seller_id ||
    (typeof req.get === "function" ? req.get("x-seller-id") : "") ||
    ""

  if (!sellerId) {
    res.status(400).json({
      error: "Seller context required — select a store first.",
      products: [],
      count: 0,
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }
  const { limit, offset } = parseLimitOffset(
    req.query as Record<string, unknown> | undefined,
  )

  try {
    let owned = await getCachedOwnedProductIds(sellerId)
    if (!owned) {
      const { data: links } = await query.graph({
        entity: "product_seller",
        fields: ["product_id"],
        filters: { seller_id: sellerId },
      })
      owned = asList(links)
        .map((r) =>
          typeof r.product_id === "string" ? r.product_id : "",
        )
        .filter(Boolean)
      void setCachedOwnedProductIds(sellerId, owned)
    }

    const count = owned.length
    const pageIds = owned.slice(offset, offset + limit)

    if (pageIds.length === 0) {
      res.status(200).json({
        products: [],
        count,
        limit,
        offset,
        source: "alkemart_exclusive",
      })
      return
    }

    const { data: productsRaw } = await query.graph({
      entity: "product",
      fields: ["id", "title", "handle", "status", "thumbnail"],
      filters: { id: pageIds },
    })
    const rows = asList(productsRaw)
    // Preserve ownership order
    const byId = new Map(rows.map((p) => [String(p.id), p]))
    const products = pageIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => ({
        id: p!.id,
        title: p!.title ?? null,
        handle: p!.handle ?? null,
        status: p!.status ?? null,
        thumbnail: p!.thumbnail ?? null,
      }))

    res.status(200).json({
      products,
      count,
      limit,
      offset,
      source: "alkemart_exclusive",
    })
  } catch (e) {
    res.status(500).json({
      error:
        e instanceof Error ? e.message : "Failed to list seller products",
      products: [],
      count: 0,
    })
  }
}
