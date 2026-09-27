/**
 * Discovery search — Workers /store/search (alias-aware, definition-backed
 * facets with server counts). Only renders API rows.
 */
import { apiJson } from "./http"
import { mapCfProductCard, type StoreProductCard } from "./products"

export type FacetDistribution = Record<string, Record<string, number>>

export type SearchResponse = {
  products: StoreProductCard[]
  query: string
  estimatedTotalHits: number
  facetDistribution: FacetDistribution
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
  min_price?: number
  max_price?: number
  /**
   * Definition-backed attribute facets: code -> selected values.
   * Sent to /store/search as `filter=code:v1,v2`. Unknown codes are a 400
   * from the API by design, never a silent zero-result page.
   */
  attributes?: Record<string, string[]>
  /** Offer condition (new, refurbished…) — server-counted in facetDistribution.condition. */
  conditions?: string[]
}

export async function searchCatalog(opts: {
  q: string
  limit?: number
  offset?: number
  filters?: SearchFilters
}): Promise<SearchResponse> {
  const q = opts.q.trim()
  const params = new URLSearchParams({
    q,
    limit: String(opts.limit ?? 48),
    offset: String(opts.offset ?? 0),
  })
  const category = opts.filters?.category_handles?.[0]?.trim()
  if (category) params.set("category", category)
  if (opts.filters?.min_price != null) {
    params.set("priceMin", String(Math.round(Number(opts.filters.min_price) * 100)))
  }
  if (opts.filters?.max_price != null) {
    params.set("priceMax", String(Math.round(Number(opts.filters.max_price) * 100)))
  }
  for (const c of opts.filters?.conditions ?? []) params.append("condition", c)
  for (const [code, values] of Object.entries(opts.filters?.attributes ?? {})) {
    // One repeated `filter` param per code keeps values containing commas intact.
    if (values.length > 0) params.append("filter", `${code}:${values.join(",")}`)
  }

  // Errors propagate: an outage must read as an outage, never as "no results".
  const data = await apiJson<{
    items?: {
      productId: string
      title: string
      slug?: string | null
      imageUrl?: string | null
      fromPricePesewas?: string
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
  }>(`/store/search?${params.toString()}`)

  // Pass the server card through untouched — stock, best offer and offer
  // count are merchandising facts, never fabricated here.
  let products = (data.items ?? []).map((item) =>
    mapCfProductCard({
      productId: item.productId,
      title: item.title,
      slug: item.slug ?? null,
      imageUrl: item.imageUrl ?? null,
      fromPricePesewas: item.fromPricePesewas ?? "0",
      bestOfferId: item.bestOfferId ?? "",
      offerCount: typeof item.offerCount === "number" ? item.offerCount : 0,
      sellerId: item.sellerId ?? "",
      sellerHandle: item.sellerHandle ?? "",
      sellerName: item.sellerName ?? "",
      availableQty: typeof item.availableQty === "number" ? item.availableQty : 0,
      createdAt: item.createdAt ?? null,
      currency: "ghs",
      categoryHandle: item.categoryHandle ?? "",
      categoryName: item.categoryName ?? "",
    } as Parameters<typeof mapCfProductCard>[0]),
  )
  // Seller narrowing has no server filter yet; narrow the real result set.
  const sellerHandles = (opts.filters?.seller_handles ?? [])
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (sellerHandles.length > 0) {
    products = products.filter((p) =>
      sellerHandles.includes((p.seller?.handle ?? "").toLowerCase()),
    )
  }
  return {
    products,
    query: q,
    estimatedTotalHits: sellerHandles.length > 0 ? products.length : (data.total ?? 0),
    facetDistribution: data.facetDistribution ?? {},
    redirect: data.redirect ?? null,
    appliedAlias: data.appliedAlias ?? null,
    suggestions: data.suggestions,
  }
}
