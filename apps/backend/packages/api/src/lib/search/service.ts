import {
  ensureProductsIndex,
  getIndexUid,
  getMeiliClient,
  getProductsIndex,
  isSearchEnabled,
} from "./client"
import { enrichDocsWithOffers, mapProductToDocument } from "./documents"
import type {
  SearchProductDocument,
  SearchQueryInput,
  SearchResult,
} from "./types"

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown }>
}

const PRODUCT_FIELDS = [
  "id",
  "title",
  "description",
  "handle",
  "thumbnail",
  "status",
  "metadata",
  "categories.id",
  "categories.handle",
  "categories.name",
  "tags.id",
  "tags.value",
  "variants.id",
  "variants.offer_id",
  "seller.id",
  "seller.name",
  "seller.handle",
]

const OFFER_FIELDS = [
  "id",
  "product_id",
  "variant_id",
  "seller_id",
  "sku",
  "seller.id",
  "seller.name",
  "seller.handle",
  "prices.amount",
  "prices.currency_code",
]

async function fetchOffersForProducts(
  query: QueryService,
  productIds?: string[],
): Promise<Record<string, unknown>[]> {
  try {
    const filters: Record<string, unknown> = {}
    if (productIds?.length) {
      filters.product_id = productIds
    }
    const { data } = await query.graph({
      entity: "offer",
      fields: OFFER_FIELDS,
      filters,
    })
    const list = Array.isArray(data) ? data : data ? [data] : []
    return list as Record<string, unknown>[]
  } catch (e) {
    console.warn(
      "[search] offer graph unavailable",
      e instanceof Error ? e.message : e,
    )
    return []
  }
}

export async function fetchProductsForIndex(
  query: QueryService,
  ids?: string[],
): Promise<SearchProductDocument[]> {
  const filters: Record<string, unknown> = {}
  if (ids?.length) {
    filters.id = ids
  }

  const { data } = await query.graph({
    entity: "product",
    fields: PRODUCT_FIELDS,
    filters,
  })

  const list = Array.isArray(data) ? data : data ? [data] : []
  let docs: SearchProductDocument[] = []
  for (const row of list) {
    const doc = mapProductToDocument(row as Record<string, unknown>)
    if (doc) docs.push(doc)
  }

  const productIds = ids?.length ? ids : docs.map((d) => d.id)
  const offers = await fetchOffersForProducts(
    query,
    productIds.length ? productIds : undefined,
  )
  if (offers.length) {
    docs = enrichDocsWithOffers(docs, offers)
  }
  return docs
}

/** Published product handles for sitemap (discovery SEO). */
export async function listPublishedSitemapEntries(
  query: QueryService,
): Promise<{ handle: string; id: string; updated_at?: string }[]> {
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status", "updated_at"],
    filters: { status: "published" },
  })
  const list = Array.isArray(data) ? data : data ? [data] : []
  const out: { handle: string; id: string; updated_at?: string }[] = []
  for (const row of list) {
    const r = row as Record<string, unknown>
    const handle = typeof r.handle === "string" ? r.handle.trim() : ""
    const id = typeof r.id === "string" ? r.id : ""
    if (!handle || !id) continue
    out.push({
      handle,
      id,
      ...(r.updated_at != null ? { updated_at: String(r.updated_at) } : {}),
    })
  }
  return out
}

/** Index only published products (discovery). */
export async function upsertProductDocuments(
  docs: SearchProductDocument[],
): Promise<number> {
  const index = getProductsIndex()
  if (!index) return 0
  await ensureProductsIndex()

  const published = docs.filter((d) => d.status === "published")
  const unpublishedIds = docs
    .filter((d) => d.status !== "published")
    .map((d) => d.id)

  if (unpublishedIds.length) {
    try {
      await index.deleteDocuments(unpublishedIds)
    } catch {
      /* ignore missing */
    }
  }

  if (!published.length) return 0
  await index.addDocuments(published, { primaryKey: "id" })
  return published.length
}

export async function deleteProductDocuments(ids: string[]): Promise<void> {
  const index = getProductsIndex()
  if (!index || !ids.length) return
  await index.deleteDocuments(ids)
}

export async function reindexAllProducts(
  query: QueryService,
): Promise<{ indexed: number; enabled: boolean }> {
  if (!isSearchEnabled()) {
    return { indexed: 0, enabled: false }
  }
  await ensureProductsIndex()
  const docs = await fetchProductsForIndex(query)
  // Wipe + replace so deleted products leave the index
  const index = getProductsIndex()!
  const published = docs.filter((d) => d.status === "published")
  await index.deleteAllDocuments()
  if (published.length) {
    await index.addDocuments(published, { primaryKey: "id" })
  }
  return { indexed: published.length, enabled: true }
}

function buildFilterExpression(input: SearchQueryInput["filters"]): string | undefined {
  if (!input) return undefined
  const parts: string[] = ['status = "published"']

  if (input.category_handles?.length) {
    const ors = input.category_handles
      .map((h) => `category_handles = "${escapeFilter(h)}"`)
      .join(" OR ")
    parts.push(`(${ors})`)
  }
  if (input.seller_handles?.length) {
    const ors = input.seller_handles
      .map((h) => `seller_handle = "${escapeFilter(h)}"`)
      .join(" OR ")
    parts.push(`(${ors})`)
  }
  if (typeof input.has_offer === "boolean") {
    parts.push(`has_offer = ${input.has_offer}`)
  }
  if (typeof input.min_price === "number" && Number.isFinite(input.min_price)) {
    parts.push(`min_price >= ${input.min_price}`)
  }
  if (typeof input.max_price === "number" && Number.isFinite(input.max_price)) {
    parts.push(`min_price <= ${input.max_price}`)
  }

  return parts.join(" AND ")
}

function escapeFilter(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export async function searchProducts(
  input: SearchQueryInput,
): Promise<SearchResult> {
  const limit = Math.min(Math.max(input.limit ?? 24, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const q = (input.q ?? "").trim()

  if (!isSearchEnabled()) {
    return {
      hits: [],
      query: q,
      processingTimeMs: 0,
      estimatedTotalHits: 0,
      limit,
      offset,
      facetDistribution: {},
      engine: "disabled",
    }
  }

  const index = getProductsIndex()
  if (!index) {
    return {
      hits: [],
      query: q,
      processingTimeMs: 0,
      estimatedTotalHits: 0,
      limit,
      offset,
      facetDistribution: {},
      engine: "disabled",
    }
  }

  await ensureProductsIndex()

  const filter = buildFilterExpression(input.filters)
  const result = await index.search(q, {
    limit,
    offset,
    filter,
    facets: [
      "category_handles",
      "seller_handle",
      "has_offer",
      "currency_code",
    ],
  })

  return {
    hits: (result.hits ?? []) as SearchProductDocument[],
    query: q,
    processingTimeMs: result.processingTimeMs ?? 0,
    estimatedTotalHits:
      result.estimatedTotalHits ?? result.hits?.length ?? 0,
    limit,
    offset,
    facetDistribution:
      (result.facetDistribution as SearchResult["facetDistribution"]) ?? {},
    engine: "meilisearch",
  }
}

export async function searchHealth(): Promise<{
  enabled: boolean
  host: string | null
  index: string
  reachable: boolean
  error?: string
}> {
  if (!isSearchEnabled()) {
    return {
      enabled: false,
      host: null,
      index: getIndexUid(),
      reachable: false,
    }
  }
  const c = getMeiliClient()
  try {
    await c!.health()
    return {
      enabled: true,
      host: process.env.MEILISEARCH_HOST?.trim() ?? null,
      index: getIndexUid(),
      reachable: true,
    }
  } catch (e) {
    return {
      enabled: true,
      host: process.env.MEILISEARCH_HOST?.trim() ?? null,
      index: getIndexUid(),
      reachable: false,
      error: e instanceof Error ? e.message : "unreachable",
    }
  }
}
