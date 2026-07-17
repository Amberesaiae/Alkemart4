import type { SearchProductDocument } from "./types"

type Loose = Record<string, unknown>

function str(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : ""
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/**
 * Map a Medusa/Mercur product graph row into a search document.
 * Only uses fields present on the entity — never invents IDs.
 */
export function mapProductToDocument(raw: Loose): SearchProductDocument | null {
  const id = str(raw.id).trim()
  if (!id) return null

  const status = str(raw.status || "draft").toLowerCase()
  const categories = asArray<Loose>(raw.categories)
  const tags = asArray<Loose>(raw.tags)
  const variants = asArray<Loose>(raw.variants)

  const seller =
    (raw.seller as Loose | undefined) ??
    (raw.seller_link as Loose | undefined) ??
    null

  let sellerId: string | null = null
  let sellerHandle: string | null = null
  let sellerName: string | null = null
  if (seller && typeof seller === "object") {
    sellerId = str(seller.id) || null
    sellerHandle = str(seller.handle) || null
    sellerName = str(seller.name) || null
  }

  // Metadata fallbacks (lab / ETL)
  const meta = (raw.metadata as Loose | null) ?? null
  if (meta) {
    if (!sellerName && typeof meta.seller_name === "string") {
      sellerName = meta.seller_name
    }
    if (!sellerHandle && typeof meta.seller_handle === "string") {
      sellerHandle = meta.seller_handle
    }
    if (!sellerId && typeof meta.seller_id === "string") {
      sellerId = meta.seller_id
    }
  }

  let minPrice: number | null = null
  let currency: string | null = null
  let hasOffer = false

  for (const v of variants) {
    if (typeof v.offer_id === "string" && v.offer_id) hasOffer = true
    const calc = v.calculated_price as Loose | undefined
    if (calc && calc.calculated_amount != null) {
      const n = Number(calc.calculated_amount)
      if (Number.isFinite(n)) {
        if (minPrice == null || n < minPrice) minPrice = n
        if (typeof calc.currency_code === "string") {
          currency = calc.currency_code
        }
      }
    }
  }

  return {
    id,
    title: str(raw.title) || "Untitled",
    description: str(raw.description),
    handle: str(raw.handle),
    thumbnail: str(raw.thumbnail) || null,
    status,
    category_ids: categories.map((c) => str(c.id)).filter(Boolean),
    category_handles: categories.map((c) => str(c.handle)).filter(Boolean),
    category_names: categories.map((c) => str(c.name)).filter(Boolean),
    seller_id: sellerId,
    seller_handle: sellerHandle,
    seller_name: sellerName,
    min_price: minPrice,
    currency_code: currency,
    has_offer: hasOffer,
    tags: tags
      .map((t) => str(t.value || t.id))
      .filter(Boolean),
  }
}
