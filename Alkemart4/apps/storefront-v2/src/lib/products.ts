/**
 * Catalog client — Workers API only. Maps API payloads into the storefront
 * card shape; never invents products, offers, prices or sellers.
 */
import { apiJson } from "./http"
import { thumbOf } from "@alkemart/shared/media"
import { getAlkemartApiUrl } from "./env"
import {
  getCatalog,
  getCategories,
  getProduct,
  getSellerShop,
  setBaseUrl,
  type PeerOffer as CfPeerOffer,
  type ProductCard as CfProductCard,
  type ProductDetail as CfProductDetail,
} from "./api-client"
import type { SellerRef } from "./seller"
import { pesewasToMajor } from "@alkemart/shared/ghana"

export type StoreProductCard = {
  id: string
  title: string
  handle?: string | null
  /** URL handle for /product/{slug}-{id}; null on rows predating slugs. */
  slug?: string | null
  thumbnail?: string | null
  images?: { url: string }[] | null
  description?: string | null
  /** Present when store API hydrates offer on variants — never invented. */
  offerId?: string | null
  /** Major currency units for Price display — derived from API (never invented). */
  amount?: number | null
  currencyCode?: string | null
  /** Multivendor: number of sellable peer offers on this product. */
  offerCount?: number | null
  /** Processed webp thumbnail (thumb_url) when available. */
  thumbUrl?: string | null
  /** Processed webp full-size (web_url) when available. */
  webUrl?: string | null
  /** Seller identity if store API returns it — omit when missing. */
  seller?: SellerRef | null
  /** Variant option types in display order (V1 matrix; empty for legacy). */
  optionTypes?: { name: string; values: { value: string; imageUrl: string | null }[] }[]
  /**
   * Structured facts about the item — what it *is* (1ltr, glass bottle),
   * as opposed to optionTypes, which is what a buyer *chooses*.
   */
  attributes?: { label: string; value: string }[]
  /** Aggregate of published reviews. */
  ratingAvg?: number | null
  ratingCount?: number
  reviews?: { rating: number; title: string | null; body: string; vendorResponse: string | null; createdAt: string }[]
  /** Every combination incl. unstocked/archived. */
  combos?: {
    offerId: string
    sellerId: string
    options: Record<string, string>
    amount: number | null
    availableQty: number
    active: boolean
  }[]
  /** Category line above the title — API metadata only. */
  categoryLabel?: string | null
  /** Real category handles from the API taxonomy — prefer over heuristics. */
  categoryHandles?: string[] | null
  /** ISO timestamp of product creation — for "recently added" sort. */
  createdAt?: string | null
  /** Sellable units behind the card's best offer — null when unknown. */
  availableQty?: number | null
  /**
   * Product identity (ADR-002). Comparison UI renders only when
   * `comparisonEligible` is true; absent on pre-identity API responses,
   * which read as eligible to preserve existing behavior.
   */
  identity?: {
    brand?: string | null
    model?: string | null
    gtin?: string | null
    mpn?: string | null
    manufacturer?: string | null
    productType?: string | null
    identityConfidence?: "identified" | "matched" | "seller_specific" | null
    comparisonEligible?: boolean | null
  } | null
}

function ensureCloudflareBaseUrl(): void {
  setBaseUrl(getAlkemartApiUrl())
}

function pesewasStringToMajor(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null
  try {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return null
    return pesewasToMajor(n)
  } catch {
    return null
  }
}

/**
 * Ratings ride along with the catalogue card response (joined from published
 * reviews). The generated client type predates the fields, so read them
 * defensively — and treat "no reviews" as absent, never as zero.
 */
function readCardRating(c: CfProductCard): { ratingAvg: number | null; ratingCount: number } {
  const raw = c as unknown as { ratingAvg?: unknown; ratingCount?: unknown }
  const count =
    typeof raw.ratingCount === "number" && Number.isFinite(raw.ratingCount) && raw.ratingCount > 0
      ? Math.trunc(raw.ratingCount)
      : 0
  const avg =
    typeof raw.ratingAvg === "number" && Number.isFinite(raw.ratingAvg) && count > 0
      ? raw.ratingAvg
      : null
  return avg == null ? { ratingAvg: null, ratingCount: 0 } : { ratingAvg: avg, ratingCount: count }
}

/** Map a Workers catalog card to the storefront product shape (shared by PLP + search). */
/** Route param for /product/$id: "{slug}-{id}" when a slug exists, else the id. */
export function productParam(card: { id: string; slug?: string | null }): string {
  const slug = card.slug?.trim()
  return slug ? `${slug}-${card.id}` : card.id
}

export function productPath(card: { id: string; slug?: string | null }): string {
  const slug = card.slug?.trim()
  return `/product/${slug ? `${slug}-${card.id}` : card.id}`
}

export function mapCfProductCard(c: CfProductCard): StoreProductCard {
  return {
    id: c.productId,
    title: c.title,
    handle: null,
    slug: c.slug ?? null,
    thumbnail: c.imageUrl ?? null,
    thumbUrl: thumbOf(c.imageUrl),
    offerId: c.bestOfferId,
    offerCount: c.offerCount,
    amount: pesewasStringToMajor(c.fromPricePesewas),
    currencyCode: c.currency === "ghs" ? "ghs" : c.currency,
    categoryLabel: c.categoryName,
    categoryHandles: c.categoryHandle ? [c.categoryHandle] : null,
    seller: c.sellerName
      ? {
          id: c.sellerId,
          name: c.sellerName,
          handle: c.sellerHandle,
        }
      : null,
    availableQty: typeof c.availableQty === "number" ? c.availableQty : null,
    createdAt: c.createdAt ?? null,
    ...readCardRating(c),
  }
}

function readAttributes(d: unknown): { label: string; value: string }[] {
  const raw = (d as { attributes?: unknown } | null)?.attributes
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (a): a is { label: string; value: string } =>
      a != null &&
      typeof a === "object" &&
      typeof (a as { label?: unknown }).label === "string" &&
      typeof (a as { value?: unknown }).value === "string",
  )
}

/** Sellable units across a product's active combinations; null when the
 * API sent none, so cards never claim "sold out" without a stock fact. */
export function detailAvailableQty(combos: { availableQty?: number | null; active?: boolean }[] | null | undefined): number | null {
  if (!combos?.length) return null
  return combos.reduce((sum, c) => sum + (c.active !== false && typeof c.availableQty === "number" ? Math.max(0, c.availableQty) : 0), 0)
}

function mapCfDetail(d: CfProductDetail): StoreProductCard {
  const best = d.offers[0]
  return {
    // Same stock fact the catalog card carries, so detail-loaded cards
    // (recently viewed, cart suggestions) show "Sold out" too.
    availableQty: detailAvailableQty(d.combos),
    id: d.productId,
    title: d.title,
    description: d.description ?? null,
    thumbnail: d.imageUrls?.[0] ?? null,
    images: (d.imageUrls ?? []).map((url) => ({ url })),
    thumbUrl: thumbOf(d.imageUrls?.[0]),
    offerId: best?.offerId ?? null,
    offerCount: d.offers.length,
    amount: best ? pesewasStringToMajor(best.pricePesewas) : null,
    currencyCode: best?.currency === "ghs" ? "ghs" : best?.currency ?? "ghs",
    categoryLabel: d.categoryName,
    categoryHandles: d.categoryHandle ? [d.categoryHandle] : null,
    // `attributes` ships on the API response but is not yet in the generated
    // OpenAPI client type, so it is read defensively here. Regenerating
    // packages/api-client from the spec removes the cast.
    attributes: readAttributes(d),
    seller: best
      ? {
          id: best.sellerId,
          name: best.sellerName,
          handle: best.sellerHandle,
        }
      : null,
    optionTypes: (d.optionTypes ?? []).map((t) => ({
      name: t.name,
      values: (t.values ?? []).map((v) => ({ value: v.value, imageUrl: v.imageUrl ?? null })),
    })),
    combos: (d.combos ?? []).map((c) => ({
      offerId: c.offerId,
      sellerId: c.sellerId,
      options: c.options ?? {},
      amount: pesewasStringToMajor(c.pricePesewas),
      availableQty: c.availableQty,
      active: c.active,
    })),
    ratingAvg: d.ratingAvg ?? null,
    ratingCount: d.ratingCount ?? 0,
    identity: d.identity
      ? {
          brand: d.identity.brand ?? null,
          model: d.identity.model ?? null,
          // GTIN/MPN ship on the API response but postdate the generated
          // client type — read defensively like attributes above.
          gtin: (d.identity as { gtin?: unknown }).gtin as string | null ?? null,
          mpn: (d.identity as { mpn?: unknown }).mpn as string | null ?? null,
          manufacturer: d.identity.manufacturer ?? null,
          productType: d.identity.productType ?? null,
          identityConfidence: d.identity.identityConfidence ?? null,
          comparisonEligible: d.identity.comparisonEligible ?? true,
        }
      : null,
    reviews: (d.reviews ?? []).map((r) => ({
      rating: r.rating,
      title: r.title,
      body: r.body,
      vendorResponse: r.vendorResponse,
      createdAt: r.createdAt,
    })),
  }
}

function mapCfPeer(o: CfPeerOffer, productId: string): PeerOffer {
  // The generated client type predates offer terms — read defensively.
  const raw = o as unknown as { deliveryFeePesewas?: unknown }
  return {
    offerId: o.offerId,
    options: o.options ?? {},
    productId,
    seller: {
      id: o.sellerId,
      name: o.sellerName,
      handle: o.sellerHandle,
    },
    amount: pesewasStringToMajor(o.pricePesewas),
    currencyCode: o.currency === "ghs" ? "ghs" : o.currency,
    deliveryAmount: pesewasStringToMajor(
      typeof raw.deliveryFeePesewas === "string" ? raw.deliveryFeePesewas : null,
    ),
  }
}

export async function listPopularProducts(opts?: {
  limit?: number
  window?: "7d" | "30d"
}): Promise<{ products: StoreProductCard[] }> {
  const params = new URLSearchParams({ limit: String(opts?.limit ?? 12) })
  if (opts?.window) params.set("window", opts.window)
  const data = await apiJson<{ items?: unknown[] }>(`/store/catalog/popular?${params}`)
  return {
    products: (data.items ?? [])
      .map((item) => mapCfProductCard(item as CfProductCard))
      .slice(0, opts?.limit ?? 12),
  }
}

export async function listStoreProducts(opts?: {
  limit?: number
  offset?: number
  q?: string
  /** Open seller handle — served from the seller shop endpoint. */
  sellerHandle?: string
  /** Product category handle — server catalog filter. */
  categoryHandle?: string
  sort?: "newest" | "price_asc" | "price_desc"
}): Promise<{ products: StoreProductCard[]; count: number }> {
  const limit = opts?.limit ?? 24
  const offset = opts?.offset ?? 0
  const q = opts?.q?.trim() || undefined
  const sellerHandle = opts?.sellerHandle?.trim() || undefined
  const categoryHandle = opts?.categoryHandle?.trim() || undefined
  ensureCloudflareBaseUrl()
  if (sellerHandle) {
    const shop = await getSellerShop(sellerHandle)
    let products = (shop.items ?? []).map(mapCfProductCard)
    if (q) {
      const needle = q.toLowerCase()
      products = products.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          (p.description?.toLowerCase().includes(needle) ?? false),
      )
    }
    return { products: products.slice(offset, offset + limit), count: products.length }
  }
  const res = await getCatalog({
    limit,
    offset,
    ...(categoryHandle ? { category: categoryHandle } : {}),
    ...(q ? { q } : {}),
    ...(opts?.sort ? { sort: opts.sort } : {}),
  })
  const mapped = (res.items ?? []).map(mapCfProductCard)
  return { products: mapped.slice(0, limit), count: res.total ?? mapped.length }
}

/** One product by id (or slug-id) from the Workers PDP endpoint. */
export async function getStoreProduct(idOrHandle: string): Promise<StoreProductCard> {
  const key = idOrHandle.trim()
  if (!key) throw new Error("Product id or handle is required")
  ensureCloudflareBaseUrl()
  return mapCfDetail(await getProduct(key))
}

export type StoreCategory = {
  id: string
  name: string
  handle?: string | null
  rank?: number | null
  description?: string | null
  parentCategoryId?: string | null
}

/** Peer offers for multi-seller comparison — API rows only. */
export type PeerOffer = {
  offerId: string
  options?: Record<string, string>
  productId?: string | null
  seller: SellerRef
  amount?: number | null
  currencyCode?: string | null
  /** Delivery fee in major units, when the API reports it. */
  deliveryAmount?: number | null
  /** Item + delivery total in major units, when both legs are known. */
  totalAmount?: number | null
  /** Offer terms (Phase 3A); null reads as unknown — never fabricated. */
  condition?: string | null
  compareAtAmount?: number | null
  /** Shown only when the reference price carries provenance (else null). */
  discountPercent?: number | null
  deliveryPromise?: string | null
  warrantyRef?: string | null
  returnsRef?: string | null
  fulfillmentOrigin?: string | null
}

/** Buyer-controlled peer ordering (Phase 3C). */
export type PeerSort = "total" | "price" | "delivery" | "trust"

/** One append-only price move (Phase 3A integrity trail), major units. */
export type PriceMove = {
  oldAmount: number | null
  newAmount: number | null
  createdAt: string | null
}

/**
 * Variant-safe comparison payload from `GET /store/products/:id/peers`.
 * Level C listings arrive with `comparisonEligible: false` and no offers —
 * the UI must render no comparison claims in that case.
 */
export type PeerComparison = {
  offers: PeerOffer[]
  explanation: string | null
  comparisonEligible: boolean
  sort: PeerSort
  divergenceNeedsReview: boolean
  /** Recent integrity trail per offer id; absent when the price never moved. */
  priceHistory: Record<string, PriceMove[]>
}

const PEER_SORTS: PeerSort[] = ["total", "price", "delivery", "trust"]

function peerString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

function peerDiscount(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null
}

/**
 * Map the Workers peers payload defensively — an older API that returns
 * `{offers}` without terms yields rows with null terms rather than zeros.
 * Pure (no I/O) so it is unit-testable. Never throws on malformed rows:
 * rows without an offer id or seller name are skipped.
 */
export function mapWorkersPeersResponse(data: unknown, productId: string): PeerComparison | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const rawOffers = Array.isArray(d.offers) ? d.offers : []
  const offers: PeerOffer[] = []
  for (const item of rawOffers) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const offerId = typeof o.offerId === "string" ? o.offerId : null
    const sellerName = typeof o.sellerName === "string" ? o.sellerName.trim() : ""
    if (!offerId || !sellerName) continue
    const amount = pesewasStringToMajor(
      typeof o.pricePesewas === "string" ? o.pricePesewas : null,
    )
    const delivery = pesewasStringToMajor(
      typeof o.deliveryFeePesewas === "string" ? o.deliveryFeePesewas : null,
    )
    // Integer math on the minor units first so GHS 100.10 + 5.05 never
    // drifts through float addition.
    const priceN = typeof o.pricePesewas === "string" ? Number(o.pricePesewas) : NaN
    const delN = typeof o.deliveryFeePesewas === "string" ? Number(o.deliveryFeePesewas) : NaN
    let total: number | null
    try {
      total =
        Number.isFinite(priceN) && Number.isFinite(delN)
          ? pesewasToMajor(Math.round(priceN) + Math.round(delN))
          : amount
    } catch {
      total = amount
    }
    const sellerHandle = typeof o.sellerHandle === "string" ? o.sellerHandle : null
    const sellerId = typeof o.sellerId === "string" ? o.sellerId : null
    offers.push({
      offerId,
      options: (o.options as Record<string, string> | undefined) ?? {},
      productId,
      seller: { id: sellerId, name: sellerName, handle: sellerHandle },
      amount,
      currencyCode: "ghs",
      deliveryAmount: delivery,
      totalAmount: total,
      condition: peerString(o.condition),
      compareAtAmount: pesewasStringToMajor(
        typeof o.compareAtPesewas === "string" ? o.compareAtPesewas : null,
      ),
      discountPercent: peerDiscount(o.discountPercent),
      deliveryPromise: peerString(o.deliveryPromise),
      warrantyRef: peerString(o.warrantyRef),
      returnsRef: peerString(o.returnsRef),
      fulfillmentOrigin: peerString(o.fulfillmentOrigin),
    })
  }
  const rawSort = typeof d.sort === "string" ? d.sort : "total"
  const sort: PeerSort = (PEER_SORTS as string[]).includes(rawSort) ? (rawSort as PeerSort) : "total"
  const priceHistory: Record<string, PriceMove[]> = {}
  const rawHistory = (d as Record<string, unknown>).priceHistory
  if (rawHistory && typeof rawHistory === "object") {
    for (const [offerId, entries] of Object.entries(rawHistory)) {
      if (!Array.isArray(entries)) continue
      const moves: PriceMove[] = []
      for (const item of entries) {
        if (!item || typeof item !== "object") continue
        const h = item as Record<string, unknown>
        moves.push({
          oldAmount: pesewasStringToMajor(
            typeof h.oldPricePesewas === "string" ? h.oldPricePesewas : null,
          ),
          newAmount: pesewasStringToMajor(
            typeof h.newPricePesewas === "string" ? h.newPricePesewas : null,
          ),
          createdAt: typeof h.createdAt === "string" ? h.createdAt : null,
        })
      }
      if (moves.length > 0) priceHistory[offerId] = moves
    }
  }
  return {
    offers,
    explanation: peerString(d.explanation),
    comparisonEligible: d.comparisonEligible !== false,
    sort,
    divergenceNeedsReview: d.divergenceNeedsReview === true,
    priceHistory,
  }
}

/**

/**
 * Variant-safe comparison: `GET /store/products/:id/peers` (confidence-gated,
 * server-sorted, with terms + explanation). Falls back to the PDP detail
 * offers. Never throws — an empty comparison renders as "no comparison
 * available", never as invented sellers.
 */
export async function getPeerComparison(
  productId: string,
  opts?: { sort?: PeerSort },
): Promise<PeerComparison> {
  const pid = productId.trim()
  const sort = opts?.sort ?? "total"
  const empty: PeerComparison = {
    offers: [],
    explanation: null,
    comparisonEligible: true,
    sort,
    divergenceNeedsReview: false,
    priceHistory: {},
  }
  if (!pid) return empty
  try {
    const mapped = mapWorkersPeersResponse(
      await apiJson(`/store/products/${encodeURIComponent(pid)}/peers?sort=${sort}`),
      pid,
    )
    if (mapped) return { ...mapped, sort }
  } catch {
    /* fall through to the detail-offers mapping */
  }
  try {
    ensureCloudflareBaseUrl()
    const detail = await getProduct(pid)
    return {
      ...empty,
      offers: (detail.offers ?? []).map((o) => mapCfPeer(o, pid)),
      comparisonEligible: detail.identity?.comparisonEligible !== false,
    }
  } catch {
    return empty
  }
}

/**
 * Governed alternatives (Phase 8A): attribute-aware similar products for
 * the PDP rail — never peer offers. Sellable-only with per-seller
 * diversity caps, served by the API. Empty when unknown; the PDP falls
 * back to its legacy related list.
 */
export async function listSimilarAlternatives(
  productId: string,
  limit = 8,
): Promise<StoreProductCard[]> {
  const pid = productId.trim()
  if (!pid) return []
  const base = getAlkemartApiUrl()
  try {
    const res = await fetch(
      `${base}/store/products/${encodeURIComponent(pid)}/alternatives?limit=${Math.min(12, Math.max(1, limit))}`,
      { headers: { Accept: "application/json" } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { alternatives?: unknown }
    if (!Array.isArray(data.alternatives)) return []
    const out: StoreProductCard[] = []
    for (const item of data.alternatives) {
      if (!item || typeof item !== "object") continue
      try {
        const card = mapCfProductCard(item as unknown as CfProductCard)
        if (card.id && card.title && card.id !== pid) out.push(card)
      } catch {
        /* skip malformed rows */
      }
    }
    return out
  } catch {
    return []
  }
}

export async function listRelatedProducts(opts: {
  excludeProductId: string
  sellerId?: string | null
  sellerName?: string | null
  limit?: number
}): Promise<{
  products: StoreProductCard[]
  /** How the list was filtered — for honest UI labels only */
  mode: "seller" | "catalog"
}> {
  const limit = opts.limit ?? 8
  const { products } = await listStoreProducts({ limit: 48 })
  const exclude = opts.excludeProductId
  const others = products.filter((p) => p.id !== exclude)

  const sellerId = opts.sellerId?.trim()
  const sellerName = opts.sellerName?.trim()?.toLowerCase()

  if (sellerId || sellerName) {
    const sameSeller = others.filter((p) => {
      if (sellerId && p.seller?.id === sellerId) return true
      if (
        sellerName &&
        p.seller?.name?.trim().toLowerCase() === sellerName
      ) {
        return true
      }
      return false
    })
    if (sameSeller.length > 0) {
      return { products: sameSeller.slice(0, limit), mode: "seller" }
    }
  }

  return { products: others.slice(0, limit), mode: "catalog" }
}

/** Newest real listings — honest curation, no invented "trending". */
export async function fetchFeaturedProducts(): Promise<StoreProductCard[]> {
  const { products } = await listStoreProducts({ limit: 36, offset: 0, sort: "newest" })
  return products
}

function flattenCategoryTree(
  nodes: Array<{
    id: string
    handle: string
    name: string
    parentId?: string | null
    children?: unknown[]
  }>,
  rankBase = 0,
): StoreCategory[] {
  const out: StoreCategory[] = []
  nodes.forEach((n, i) => {
    out.push({
      id: n.id,
      name: n.name,
      handle: n.handle,
      rank: rankBase + i,
      parentCategoryId: n.parentId ?? null,
    })
    const kids = (n.children ?? []) as typeof nodes
    if (kids.length) out.push(...flattenCategoryTree(kids, rankBase + i * 100))
  })
  return out
}


export async function listStoreCategories(): Promise<StoreCategory[]> {
  ensureCloudflareBaseUrl()
  const res = await getCategories()
  return flattenCategoryTree(res.categories ?? [])
}

export async function listStoreSellers(): Promise<{ handle: string; name: string }[]> {
  const data = await apiJson<{ sellers?: { handle: string; name: string }[] }>("/store/sellers")
  return (data.sellers ?? []).map((s) => ({ handle: s.handle, name: s.name }))
}
