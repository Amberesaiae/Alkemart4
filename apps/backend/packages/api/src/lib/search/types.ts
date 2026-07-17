/** Indexed product document for Meilisearch (discovery only — not money SoR). */

export type SearchProductDocument = {
  id: string
  title: string
  description: string
  handle: string
  thumbnail: string | null
  status: string
  category_ids: string[]
  category_handles: string[]
  category_names: string[]
  seller_id: string | null
  seller_handle: string | null
  seller_name: string | null
  /** Lowest known amount in major units if available; else null */
  min_price: number | null
  currency_code: string | null
  has_offer: boolean
  tags: string[]
}

export type SearchFacetDistribution = Record<
  string,
  Record<string, number>
>

export type SearchResult = {
  hits: SearchProductDocument[]
  query: string
  processingTimeMs: number
  estimatedTotalHits: number
  limit: number
  offset: number
  facetDistribution: SearchFacetDistribution
  engine: "meilisearch" | "disabled"
}

export type SearchQueryInput = {
  q?: string
  limit?: number
  offset?: number
  /** Facet filters: attribute → selected values (OR within, AND across) */
  filters?: {
    category_handles?: string[]
    seller_handles?: string[]
    has_offer?: boolean
    min_price?: number
    max_price?: number
  }
}
