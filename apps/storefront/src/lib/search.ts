/**
 * Discovery search — prefers backend Meilisearch proxy; falls back to product.list.
 * Never invents product IDs; only renders API hits.
 */
import { getBackendUrl, getPublishableKey } from "./env"
import { listStoreProducts, type StoreProductCard } from "./products"

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
  engine: "meilisearch" | "medusa" | "disabled" | "error"
  processingTimeMs?: number
}

export type SearchFilters = {
  category_handles?: string[]
  seller_handles?: string[]
  has_offer?: boolean
  min_price?: number
  max_price?: number
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
