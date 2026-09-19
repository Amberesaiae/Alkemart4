import { pesewasToMajor } from "@alkemart/shared/ghana"
import type { PeerOffer as CfPeerOffer, ProductCard as CfProductCard, ProductDetail as CfProductDetail } from "@alkemart/api-client"
import { ensureApiBaseUrl, getCatalog, getCategories, getProduct, getSellerShop } from "./api"
import { getAlkemartApiUrl } from "./env"
import type { SellerRef } from "./cart"
import type { NavCategory } from "./catalog-nav"

export type StoreProductCard = {
  id: string
  title: string
  handle?: string | null
  thumbnail?: string | null
  images?: { url: string }[] | null
  description?: string | null
  offerId?: string | null
  amount?: number | null
  currencyCode?: string | null
  offerCount?: number | null
  seller?: SellerRef | null
  ratingAvg?: number | null
  ratingCount?: number
  reviews?: {
    rating: number
    title: string | null
    body: string
    vendorResponse: string | null
    createdAt: string
  }[]
  attributes?: { label: string; value: string }[]
  categoryLabel?: string | null
  categoryHandles?: string[] | null
  createdAt?: string | null
  availableQty?: number | null
}

export type StoreCategory = NavCategory & {
  description?: string | null
}

export type PeerOffer = {
  offerId: string
  options?: Record<string, string>
  productId?: string | null
  seller: SellerRef
  amount?: number | null
  currencyCode?: string | null
}

function pesewasStringToMajor(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return pesewasToMajor(n)
}

function mapCfProductCard(c: CfProductCard): StoreProductCard {
  return {
    id: c.productId,
    title: c.title,
    handle: null,
    thumbnail: c.imageUrl ?? null,
    offerId: c.bestOfferId,
    offerCount: c.offerCount,
    amount: pesewasStringToMajor(c.fromPricePesewas),
    currencyCode: c.currency === "ghs" ? "ghs" : c.currency,
    categoryLabel: c.categoryName,
    categoryHandles: c.categoryHandle ? [c.categoryHandle] : null,
    seller: c.sellerName
      ? { id: c.sellerId, name: c.sellerName, handle: c.sellerHandle }
      : null,
    availableQty: typeof c.availableQty === "number" ? c.availableQty : null,
    createdAt: c.createdAt ?? null,
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

function mapCfDetail(d: CfProductDetail): StoreProductCard {
  const best = d.offers[0]
  return {
    id: d.productId,
    title: d.title,
    description: d.description ?? null,
    thumbnail: d.imageUrls?.[0] ?? null,
    images: (d.imageUrls ?? []).map((url) => ({ url })),
    offerId: best?.offerId ?? null,
    offerCount: d.offers.length,
    amount: best ? pesewasStringToMajor(best.pricePesewas) : null,
    currencyCode: best?.currency === "ghs" ? "ghs" : best?.currency ?? "ghs",
    categoryLabel: d.categoryName,
    categoryHandles: d.categoryHandle ? [d.categoryHandle] : null,
    attributes: readAttributes(d),
    seller: best
      ? { id: best.sellerId, name: best.sellerName, handle: best.sellerHandle }
      : null,
    ratingAvg: d.ratingAvg ?? null,
    ratingCount: d.ratingCount ?? 0,
    reviews: (d.reviews ?? []).map((r) => ({
      rating: r.rating,
      title: r.title,
      body: r.body,
      vendorResponse: r.vendorResponse,
      createdAt: r.createdAt,
    })),
    availableQty: best?.available ?? null,
  }
}

function mapCfPeer(o: CfPeerOffer, productId: string): PeerOffer {
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
  }
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

export async function listStoreProducts(opts?: {
  limit?: number
  offset?: number
  q?: string
  sellerHandle?: string
  categoryHandle?: string
  sort?: "newest" | "price_asc" | "price_desc"
}): Promise<{ products: StoreProductCard[]; count: number }> {
  if (!getAlkemartApiUrl()) return { products: [], count: 0 }
  ensureApiBaseUrl()
  const limit = opts?.limit ?? 24
  const offset = opts?.offset ?? 0
  const sellerHandle = opts?.sellerHandle?.trim()
  const q = opts?.q?.trim() || undefined

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
    const sliced = products.slice(offset, offset + limit)
    return { products: sliced, count: products.length }
  }

  const res = await getCatalog({
    limit,
    offset,
    ...(opts?.categoryHandle?.trim() ? { category: opts.categoryHandle.trim() } : {}),
    ...(q ? { q } : {}),
    ...(opts?.sort ? { sort: opts.sort } : {}),
  })
  return {
    products: (res.items ?? []).map(mapCfProductCard),
    count: res.total ?? res.items?.length ?? 0,
  }
}

export async function getStoreProduct(idOrHandle: string): Promise<StoreProductCard> {
  const key = idOrHandle.trim()
  if (!key) throw new Error("Product id or handle is required")
  if (!getAlkemartApiUrl()) throw new Error("VITE_ALKEMART_API_URL is not set")
  ensureApiBaseUrl()
  return mapCfDetail(await getProduct(key))
}

export async function listPeerOffersForProduct(productId: string): Promise<PeerOffer[]> {
  const pid = productId.trim()
  if (!pid || !getAlkemartApiUrl()) return []
  try {
    ensureApiBaseUrl()
    const detail = await getProduct(pid)
    return (detail.offers ?? []).map((o) => mapCfPeer(o, pid))
  } catch {
    return []
  }
}

export async function fetchFeaturedProducts(): Promise<StoreProductCard[]> {
  try {
    const { products } = await listStoreProducts({ limit: 12, offset: 0, sort: "newest" })
    return products
  } catch {
    return []
  }
}

export async function listStoreCategories(): Promise<StoreCategory[]> {
  if (!getAlkemartApiUrl()) return []
  try {
    ensureApiBaseUrl()
    const res = await getCategories()
    return flattenCategoryTree(res.categories ?? [])
  } catch {
    return []
  }
}

export async function listSellerShop(handle: string) {
  if (!getAlkemartApiUrl()) return null
  ensureApiBaseUrl()
  return getSellerShop(handle)
}
