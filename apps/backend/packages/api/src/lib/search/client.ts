import { Meilisearch } from "meilisearch"
import type { SearchProductDocument } from "./types"

/**
 * Meilisearch JS SDK v0.50+ exports `Meilisearch` (not `MeiliSearch`).
 * Keep a thin typed wrapper so Medusa routes do not depend on SDK typings tightly.
 */

type MeiliClient = {
  index: (uid: string) => MeiliIndex
  createIndex: (
    uid: string,
    opts?: { primaryKey?: string },
  ) => Promise<unknown>
  health: () => Promise<unknown>
}

type MeiliIndex = {
  updateSettings: (settings: Record<string, unknown>) => Promise<unknown>
  addDocuments: (
    docs: SearchProductDocument[],
    opts?: { primaryKey?: string },
  ) => Promise<unknown>
  deleteDocuments: (ids: string[]) => Promise<unknown>
  deleteAllDocuments: () => Promise<unknown>
  search: (
    q: string,
    opts?: Record<string, unknown>,
  ) => Promise<{
    hits?: SearchProductDocument[]
    processingTimeMs?: number
    estimatedTotalHits?: number
    facetDistribution?: Record<string, Record<string, number>>
  }>
}

const INDEX_UID = process.env.MEILISEARCH_INDEX_UID?.trim() || "products"

export function isSearchEnabled(): boolean {
  const host = process.env.MEILISEARCH_HOST?.trim()
  return Boolean(host)
}

export function getSearchHost(): string {
  return (process.env.MEILISEARCH_HOST ?? "").trim().replace(/\/$/, "")
}

export function getSearchApiKey(): string {
  return (process.env.MEILISEARCH_API_KEY ?? "").trim()
}

let client: MeiliClient | null = null

export function getMeiliClient(): MeiliClient | null {
  if (!isSearchEnabled()) return null
  if (client) return client
  client = new Meilisearch({
    host: getSearchHost(),
    apiKey: getSearchApiKey() || undefined,
  }) as unknown as MeiliClient
  return client
}

export function getProductsIndex(): MeiliIndex | null {
  const c = getMeiliClient()
  if (!c) return null
  return c.index(INDEX_UID)
}

export function getIndexUid(): string {
  return INDEX_UID
}

/** Create index + facet/searchable settings (idempotent). */
export async function ensureProductsIndex(): Promise<boolean> {
  const c = getMeiliClient()
  if (!c) return false

  try {
    await c.createIndex(INDEX_UID, { primaryKey: "id" })
  } catch {
    /* exists */
  }

  const index = c.index(INDEX_UID)
  await index.updateSettings({
    searchableAttributes: [
      "title",
      "description",
      "handle",
      "seller_name",
      "category_names",
      "tags",
    ],
    filterableAttributes: [
      "status",
      "category_ids",
      "category_handles",
      "seller_id",
      "seller_handle",
      "has_offer",
      "min_price",
      "currency_code",
      "tags",
    ],
    sortableAttributes: ["min_price", "title"],
    displayedAttributes: [
      "id",
      "title",
      "description",
      "handle",
      "thumbnail",
      "status",
      "category_ids",
      "category_handles",
      "category_names",
      "seller_id",
      "seller_handle",
      "seller_name",
      "min_price",
      "currency_code",
      "has_offer",
      "tags",
    ],
    // Ghana / EN discovery helpers — not UI-facing; expand carefully
    synonyms: {
      oil: ["cooking oil", "palm oil", "vegetable oil"],
      palm: ["palm oil", "red oil"],
      phone: ["mobile", "smartphone", "handset"],
      momo: ["mobile money", "mtn", "vodafone", "telecel"],
      accra: ["greater accra", "tema", "spintex"],
    },
  })

  return true
}
