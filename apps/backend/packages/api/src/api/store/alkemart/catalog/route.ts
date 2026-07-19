/**
 * GET /store/alkemart/catalog
 * Buyer-facing product cards from Mercur offers (SoT for ATC).
 *
 * Query (all optional):
 *   limit, offset
 *   seller_handle — filter by open seller handle
 *   category_handle — product must be linked to this category handle
 *
 * Performance (P1.1):
 *   1) Light graph: ids + filter fields only (no description)
 *   2) Unique product ids → paginate in product space
 *   3) Heavy graph: full card fields only for that page's product_ids
 * Graph filters push seller/product status (and handle) to the data layer when possible.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  accumulateOffersToCards,
  parseLimitOffset,
  uniqueProductIdsFromOffers,
  type CatalogOfferRow,
} from "../../../../lib/catalog-map"
import {
  getCatalogCache,
  setCatalogCache,
} from "../../../../lib/catalog-cache"

function asList(data: unknown): CatalogOfferRow[] {
  if (Array.isArray(data)) return data as CatalogOfferRow[]
  if (data && typeof data === "object") return [data as CatalogOfferRow]
  return []
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v != null ? String(v).trim() : ""
}

/** Fields for filter + id discovery only (lean). */
const LIGHT_OFFER_FIELDS = [
  "id",
  "product_id",
  "seller_id",
  "seller.id",
  "seller.handle",
  "seller.status",
  "product.id",
  "product.status",
  "product.categories.id",
  "product.categories.handle",
]

/** Full card payload for one page of products. */
const HEAVY_OFFER_FIELDS = [
  "id",
  "product_id",
  "variant_id",
  "seller_id",
  "seller.id",
  "seller.name",
  "seller.handle",
  "seller.status",
  "prices.id",
  "prices.amount",
  "prices.currency_code",
  "product.id",
  "product.title",
  "product.handle",
  "product.thumbnail",
  // P1.2: no description on PLP cards — less IO / graph expansion
  "product.status",
  "product.categories.id",
  "product.categories.name",
  "product.categories.handle",
]

function buildOfferFilters(opts: {
  sellerHandle: string
  categoryHandle: string
}): Record<string, unknown> {
  const productFilter: Record<string, unknown> = {
    status: "published",
  }
  if (opts.categoryHandle) {
    productFilter.categories = { handle: opts.categoryHandle }
  }

  const sellerFilter: Record<string, unknown> = {
    status: "open",
  }
  if (opts.sellerHandle) {
    sellerFilter.handle = opts.sellerHandle
  }

  return {
    product: productFilter,
    seller: sellerFilter,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown; metadata?: unknown }>
  }

  const sellerHandle = str(req.query?.seller_handle).toLowerCase()
  const categoryHandle = str(req.query?.category_handle).toLowerCase()
  const { limit, offset } = parseLimitOffset(req.query?.limit, req.query?.offset)

  const filters = buildOfferFilters({ sellerHandle, categoryHandle })
  const cacheParams = {
    sellerHandle,
    categoryHandle,
    limit,
    offset,
  }

  try {
    // ─── Cache (Redis) — skip DB when warm ──────────────────────────
    const cached = await getCatalogCache(cacheParams)
    if (cached) {
      res.status(200).json({
        ...cached,
        cache: "hit",
      })
      return
    }

    // ─── Pass 1: light list for product-id universe ─────────────────
    let lightRows: CatalogOfferRow[] = []
    try {
      const light = await query.graph({
        entity: "offer",
        fields: LIGHT_OFFER_FIELDS,
        filters,
      })
      lightRows = asList(light.data)
    } catch {
      // Nested filters may not be supported on all graph backends — fallback unfiltered light
      const light = await query.graph({
        entity: "offer",
        fields: LIGHT_OFFER_FIELDS,
      })
      lightRows = asList(light.data)
    }

    // Client-side safety filter (handles fallback + incomplete graph filters)
    const productIdsAll = uniqueProductIdsFromOffers(
      lightRows.filter((o) => {
        const pStatus = String(o.product?.status || "").toLowerCase()
        if (pStatus && pStatus !== "published") return false
        const sStatus = String(o.seller?.status || "open").toLowerCase()
        if (sStatus && sStatus !== "open") return false
        if (sellerHandle) {
          const h = str(o.seller?.handle).toLowerCase()
          if (h !== sellerHandle) return false
        }
        if (categoryHandle) {
          const cats = Array.isArray(o.product?.categories)
            ? (o.product!.categories as { handle?: string }[])
            : []
          const ok = cats.some(
            (c) => str(c.handle).toLowerCase() === categoryHandle,
          )
          if (!ok) return false
        }
        return true
      }),
    )

    const count = productIdsAll.length
    const pageIds = productIdsAll.slice(offset, offset + limit)

    if (pageIds.length === 0) {
      const emptyBody = {
        products: [] as unknown[],
        count,
        limit,
        offset,
        filter: "published_with_offer",
        seller_handle: sellerHandle || null,
        category_handle: categoryHandle || null,
        note: "Paginated product ids from offers; empty page",
        strategy: "light_ids_then_heavy_page",
      }
      void setCatalogCache(cacheParams, emptyBody)
      res.status(200).json({ ...emptyBody, cache: "miss" })
      return
    }

    // ─── Pass 2: heavy load only for this page of products ──────────
    let heavyRows: CatalogOfferRow[] = []
    try {
      const heavy = await query.graph({
        entity: "offer",
        fields: HEAVY_OFFER_FIELDS,
        filters: {
          product_id: pageIds,
          ...filters,
        },
      })
      heavyRows = asList(heavy.data)
    } catch {
      // product_id + nested filters may conflict — filter by product_id only
      const heavy = await query.graph({
        entity: "offer",
        fields: HEAVY_OFFER_FIELDS,
        filters: { product_id: pageIds },
      })
      heavyRows = asList(heavy.data)
    }

    const cards = accumulateOffersToCards(heavyRows, {
      sellerHandle: sellerHandle || undefined,
      categoryHandle: categoryHandle || undefined,
    })

    // Preserve page id order (stable listing)
    const byId = new Map(cards.map((c) => [c.id, c]))
    const products = pageIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))

    const body = {
      products,
      count,
      limit,
      offset,
      filter: "published_with_offer",
      seller_handle: sellerHandle || null,
      category_handle: categoryHandle || null,
      note: "Light id pass + heavy page pass; open sellers; GHS preferred",
      strategy: "light_ids_then_heavy_page",
    }
    void setCatalogCache(cacheParams, body)
    res.status(200).json({ ...body, cache: "miss" })
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Catalog list failed",
    })
  }
}
