/**
 * Discovery search — prefers backend Meilisearch proxy; falls back to product.list.
 * Never invents product IDs; only renders API hits.
 */
import { getAlkemartApiUrl, getBackendUrl, getPublishableKey } from "./env"
import { listStoreProducts, mapCfProductCard, type StoreProductCard } from "./products"

function useWorkersSearch(): boolean {
  return Boolean(getAlkemartApiUrl())
}

export type SearchHit = {
  id: string
  title: string
  description?: string
  handle?: string | null
  thumbnail?: string | null
  seller_id?: string | null
  seller_handle?: string | null
  seller_name?: string | null
  min_price?: number | null
  currency_code?: string | null
  has_offer?: boolean
  category_handles?: string[]
  category_names?: string[]
}

export type FacetDistribution = Record<string, Record<string, number>>

export type SearchResponse = {
  hits: SearchHit[]
  products: StoreProductCard[]
  query: string
  estimatedTotalHits: number
  facetDistribution: FacetDistribution
  engine: "workers" | "meilisearch" | "medusa" | "disabled" | "error"
  processingTimeMs?: number
  /** Canonical target when a redirect alias matched (client navigates). */
  redirect?: string | null
  /** Provenance when a synonym alias rewrote the query. */
  appliedAlias?: { term: string; kind: "synonym" | "redirect" } | null
  /** Recovery candidates on zero results (categories/shops only, never filler). */
  suggestions?: {
    categories: Array<{ id: string; name: string; slug: string }>
    shops: Array<{ handle: string; name: string }>
  }
}

export type SearchFilters = {
  category_handles?: string[]
  seller_handles?: string[]
  has_offer?: boolean
  min_price?: number
  max_price?: number
  /**
   * Ghana discovery location (optional).
   * Only effective when Meili indexes seller_province / seller_city.
   * Never invent matches client-side from empty index.
   */
  seller_province?: string
  seller_city?: string
}

function hitToCard(h: SearchHit): StoreProductCard {
  return {
    id: h.id,
    title: h.title || "Untitled",
    handle: h.handle ?? null,
    thumbnail: h.thumbnail ?? null,
    description: h.description ?? null,
    amount: h.min_price ?? null,
    currencyCode: h.currency_code ?? null,
    // Never invent offer_id — PDP loads real offer from store API
    offerId: null,
    seller: h.seller_name
      ? {
          id: h.seller_id ?? null,
          name: h.seller_name,
          handle: h.seller_handle ?? null,
        }
      : null,
  }
}

/**
 * Search via /store/search when Meilisearch is enabled on the API.
 * Falls back to Medusa product.list `q` when engine is disabled.
 */
export async function searchCatalog(opts: {
  q: string
  limit?: number
  offset?: number
  filters?: SearchFilters
}): Promise<SearchResponse> {
  const q = opts.q.trim()
  const limit = opts.limit ?? 48
  const offset = opts.offset ?? 0

  if (useWorkersSearch()) {
    // Phase 2 Workers search: alias-aware, definition-backed facets with
    // server counts. No Medusa fallback on this path by design.
    const base = getAlkemartApiUrl()!.replace(/\/$/, "")
    const params = new URLSearchParams({
      q,
      limit: String(limit),
      offset: String(offset),
    })
    const category = opts.filters?.category_handles?.[0]?.trim()
    if (category) params.set("category", category)
    if (opts.filters?.min_price != null) {
      params.set("priceMin", String(Math.round(Number(opts.filters.min_price) * 100)))
    }
    if (opts.filters?.max_price != null) {
      params.set("priceMax", String(Math.round(Number(opts.filters.max_price) * 100)))
    }
    try {
      const res = await fetch(`${base}/store/search?${params.toString()}`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) {
        return {
          hits: [],
          products: [],
          query: q,
          estimatedTotalHits: 0,
          facetDistribution: {},
          engine: "error",
        }
      }
      const data = (await res.json()) as {
        items?: {
          productId: string
          title: string
          imageUrl?: string | null
          fromPricePesewas?: string
          currency?: string
          bestOfferId?: string | null
          offerCount?: number | null
          sellerId?: string
          sellerHandle?: string
          sellerName?: string
          availableQty?: number | null
          createdAt?: string | null
          categoryHandle?: string
          categoryName?: string
        }[]
        total?: number
        redirect?: string | null
        appliedAlias?: { term: string; kind: "synonym" | "redirect" } | null
        facetDistribution?: FacetDistribution
        suggestions?: SearchResponse["suggestions"]
      }
      // Pass the server card through untouched — stock, best offer, and offer
      // count are merchandising facts. Fabricating them here once painted
      // "Few left" on every search result.
      let products = (data.items ?? []).map((item) =>
        mapCfProductCard({
          productId: item.productId,
          title: item.title,
          imageUrl: item.imageUrl ?? null,
          fromPricePesewas: item.fromPricePesewas ?? "0",
          bestOfferId: item.bestOfferId ?? "",
          offerCount: typeof item.offerCount === "number" ? item.offerCount : 0,
          sellerId: item.sellerId ?? "",
          sellerHandle: item.sellerHandle ?? "",
          sellerName: item.sellerName ?? "",
          // The search endpoint returns the same sellable card as catalog
          // (stock included); fallbacks only cover malformed rows.
          availableQty: typeof item.availableQty === "number" ? item.availableQty : 0,
          createdAt: item.createdAt ?? null,
          currency: "ghs",
          categoryHandle: item.categoryHandle ?? "",
          categoryName: item.categoryName ?? "",
        }),
      )
      // Seller-handle narrowing has no server filter yet (shops are a
      // separate result type in Doc 03); narrow the real result set locally.
      const sellerHandles = (opts.filters?.seller_handles ?? [])
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
      if (sellerHandles.length > 0) {
        products = products.filter((p) =>
          sellerHandles.includes((p.seller?.handle ?? "").toLowerCase()),
        )
      }
      return {
        hits: products.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description ?? undefined,
          handle: p.handle,
          thumbnail: p.thumbnail,
          seller_id: p.seller?.id ?? null,
          seller_handle: p.seller?.handle ?? null,
          seller_name: p.seller?.name ?? null,
          min_price: p.amount ?? null,
          currency_code: p.currencyCode ?? null,
          has_offer: Boolean(p.offerId),
        })),
        products,
        query: q,
        estimatedTotalHits: sellerHandles.length > 0 ? products.length : (data.total ?? 0),
        facetDistribution: data.facetDistribution ?? {},
        engine: "workers",
        redirect: data.redirect ?? null,
        appliedAlias: data.appliedAlias ?? null,
        suggestions: data.suggestions,
      }
    } catch {
      return {
        hits: [],
        products: [],
        query: q,
        estimatedTotalHits: 0,
        facetDistribution: {},
        engine: "error",
      }
    }
  }

  const base = getBackendUrl()
  const pk = getPublishableKey()

  try {
    const res = await fetch(`${base}/store/search`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-publishable-api-key": pk,
      },
      body: JSON.stringify({
        q,
        limit,
        offset,
        filters: opts.filters ?? {},
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as {
        hits?: SearchHit[]
        query?: string
        estimatedTotalHits?: number
        facetDistribution?: FacetDistribution
        engine?: SearchResponse["engine"]
        processingTimeMs?: number
      }

      if (data.engine === "meilisearch") {
        const hits = data.hits ?? []
        return {
          hits,
          products: hits.map(hitToCard),
          query: data.query ?? q,
          estimatedTotalHits: data.estimatedTotalHits ?? hits.length,
          facetDistribution: data.facetDistribution ?? {},
          engine: "meilisearch",
          processingTimeMs: data.processingTimeMs,
        }
      }
      // disabled / empty — fall through to Medusa list
    }
  } catch {
    /* fall through */
  }

  // Fallback: Medusa product list (Phase 0 path)
  if (!q && !opts.filters?.category_handles?.length) {
    return {
      hits: [],
      products: [],
      query: q,
      estimatedTotalHits: 0,
      facetDistribution: {},
      engine: "medusa",
    }
  }

  const list = await listStoreProducts({ limit, offset, q: q || undefined })
  return {
    hits: list.products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description ?? undefined,
      handle: p.handle,
      thumbnail: p.thumbnail,
      seller_id: p.seller?.id ?? null,
      seller_handle: p.seller?.handle ?? null,
      seller_name: p.seller?.name ?? null,
      min_price: p.amount ?? null,
      currency_code: p.currencyCode ?? null,
    })),
    products: list.products,
    query: q,
    estimatedTotalHits: list.count,
    facetDistribution: {},
    engine: "medusa",
  }
}
