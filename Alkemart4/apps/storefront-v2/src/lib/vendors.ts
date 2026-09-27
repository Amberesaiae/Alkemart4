import { deliveryLabel } from "@alkemart/shared/storefront-badges"
import { getAlkemartApiUrl } from "./env"
import { apiJson } from "./http"
import { getActiveMarket } from "./market"
import { getSellerShop, setBaseUrl } from "./api-client"
import type { StorefrontBadge } from "@alkemart/shared/storefront-badges"
import type { StoreProductCard } from "./products"
import { pesewasToMajor } from "@alkemart/shared/ghana"
/** A shop card's featured product teaser. */
export type StoreCardFeatured = {
  productId: string
  title: string
  imageUrl: string | null
  fromPricePesewas: string
}

function ensureWorkersBaseUrl() {
  setBaseUrl(getAlkemartApiUrl())
}

export type StoreVendor = {
  id: string
  name: string
  slug: string
  bio?: string | null
  logo?: string | null
  banner?: string | null
  tagline?: string | null
  location?: string | null
  /** Pinpoint shop location (0035); null until the seller drops a pin. */
  lat?: number | null
  lng?: number | null
  availability?: "open" | "paused"
  ratingAvg?: number | null
  ratingCount?: number
  salesCount?: number
  deliveryMinutes?: number | null
  /** Door-to-door promise in days (takes over from minutes). */
  deliveryDays?: { min: number; max: number } | null
  badges?: StorefrontBadge[]
  featured?: StoreCardFeatured[]
}

/**
 * Map one store-card row.
 *
 * Every trust field is optional on the wire and stays optional here: an older
 * API that still returns `{id, handle, name}` yields a card with no rating,
 * no delivery band and no badges rather than a card full of zeroes.
 */
function toStoreVendor(v: Record<string, unknown>): StoreVendor | null {
  const id = String(v.id ?? "")
  const name = typeof v.name === "string" ? v.name.trim() : ""
  const slug =
    typeof v.handle === "string" ? v.handle : typeof v.slug === "string" ? v.slug : ""
  if (!id || !name || !slug) return null

  const num = (x: unknown): number | null =>
    typeof x === "number" && Number.isFinite(x) ? x : null
  const str = (x: unknown): string | null => (typeof x === "string" && x ? x : null)

  const badges = Array.isArray(v.badges)
    ? (v.badges as Record<string, unknown>[])
        .filter(
          (b) =>
            typeof b?.id === "string" &&
            typeof b?.label === "string" &&
            typeof b?.tone === "string",
        )
        .map((b) => b as unknown as StorefrontBadge)
    : []

  const featured = Array.isArray(v.featured)
    ? (v.featured as Record<string, unknown>[])
        .filter((p) => typeof p?.productId === "string" && typeof p?.title === "string")
        .map((p) => ({
          productId: String(p.productId),
          title: String(p.title),
          imageUrl: str(p.imageUrl),
          fromPricePesewas: String(p.fromPricePesewas ?? "0"),
        }))
    : []

  return {
    id,
    name,
    slug,
    bio: str(v.bio) ?? str(v.description),
    logo: str(v.logo),
    banner: str(v.banner),
    tagline: str(v.tagline),
    // Shops may store a region code (e.g. "GH02"); buyers see the name.
    location: readableRegion(getActiveMarket().regionName(str(v.location))),
    availability: v.availability === "paused" ? "paused" : "open",
    ratingAvg: num(v.ratingAvg),
    ratingCount: num(v.ratingCount) ?? 0,
    salesCount: num(v.salesCount) ?? 0,
    deliveryMinutes: num(v.deliveryMinutes),
    deliveryDays: (() => {
      const d = v.deliveryDays as { min?: unknown; max?: unknown } | null | undefined
      return d && typeof d.min === "number" && typeof d.max === "number" ? { min: d.min, max: d.max } : null
    })(),
    badges,
    featured,
  }
}

/** Marketplace shops. Errors propagate — an outage is not "no shops". */
export async function listStoreVendors(): Promise<StoreVendor[]> {
  const data = await apiJson<Record<string, unknown>>("/store/sellers")
  const raw =
    (data.sellers as Record<string, unknown>[] | undefined) ??
    (data.items as Record<string, unknown>[] | undefined) ??
    []
  const mapped: StoreVendor[] = []
  for (const v of raw) {
    const card = toStoreVendor(v)
    if (card) mapped.push(card)
  }
  return mapped
}

export type StoreVendorDetail = {
  id: string
  name: string
  slug: string
  /** Pinpoint shop location (0035); null until the seller drops a pin. */
  lat?: number | null
  lng?: number | null
  bio?: string | null
  logoImageUrl?: string | null
  coverImageUrl?: string | null
  logoThumbUrl?: string | null
  logoWebUrl?: string | null
  coverThumbUrl?: string | null
  coverWebUrl?: string | null
  ratingAvgX100?: number
  ratingCount?: number
  badgeTopSeller?: boolean
  badgeFastShipper?: boolean
  /** Declared delivery band in minutes; null when the shop has not set one. */
  deliveryMinutes?: number | null
  /** Declared door-to-door range in days (takes over from minutes). */
  deliveryDays?: { min: number; max: number } | null
  /** Computed, never vendor-typed. */
  badges?: StorefrontBadge[]
  status?: string
  availability?: { state: "open" | "paused"; pausedUntil: string | null; note: string | null }
  /** "Usually replies within an hour" — computed by the API from real replies. */
  replyTime?: { minutes: number | null; label: string | null } | null
  trust?: {
    ratingAvg: number | null
    ratingCount: number
    salesCount: number
    memberSince: string | null
    location: string | null
    tagline: string | null
    phone: string | null
    hours: { days: string; open: string; close: string } | null
    social: { instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string }
    announcement: string | null
    policy: { shipping?: string; returnsDays?: number; warranty?: string } | null
    recentReviews: {
      productTitle: string
      rating: number
      title: string | null
      body: string
      createdAt: string
    }[]
  } | null
}

/** Shop hero for /shops/$slug. Only a 404 reads as "Store not found". */
export async function getStoreVendorBySlug(slug: string): Promise<{
  vendor: StoreVendorDetail
  featuredProductIds: string[]
}> {
  ensureWorkersBaseUrl()
  let shop: Awaited<ReturnType<typeof getSellerShop>>
  try {
    shop = await getSellerShop(slug)
  } catch (err) {
    if ((err as { status?: number }).status === 404) throw new Error("Store not found", { cause: err })
    throw err
  }
  return {
        vendor: {
          id: shop.seller.id,
          name: shop.seller.name,
          slug: shop.seller.handle,
          bio: shop.seller.description ?? null,
          logoImageUrl: shop.seller.logo ?? null,
          coverImageUrl: shop.seller.banner ?? null,
          ...(() => {
            // The generated client is regenerated from openapi.yaml, which does
            // not describe these yet; read them off the wire defensively rather
            // than blocking on a spec round-trip.
            const loc = shop.seller as unknown as {
              lat?: number | null
              lng?: number | null
              deliveryMinutes?: number | null
              deliveryDays?: { min: number; max: number } | null
              replyTime?: StoreVendorDetail["replyTime"]
            }
            return {
              replyTime: loc.replyTime ?? null,
              lat: loc.lat ?? null,
              lng: loc.lng ?? null,
              deliveryMinutes: loc.deliveryMinutes ?? null,
              deliveryDays: loc.deliveryDays ?? null,
            }
          })(),
          availability: shop.seller.availability,
          trust: shop.seller.trust
            ? {
                ratingAvg: shop.seller.trust.ratingAvg ?? null,
                ratingCount: shop.seller.trust.ratingCount ?? 0,
                salesCount: shop.seller.trust.salesCount ?? 0,
                memberSince: shop.seller.trust.memberSince ?? null,
                location: getActiveMarket().regionName(shop.seller.trust.location ?? null),
                tagline: shop.seller.trust.tagline ?? null,
                phone: shop.seller.trust.phone ?? null,
                hours: shop.seller.trust.hours ?? null,
                social: shop.seller.trust.social ?? {},
                announcement: shop.seller.trust.announcement ?? null,
                policy: shop.seller.trust.policy ?? null,
                recentReviews: (shop.seller.trust.recentReviews ?? []).map((r) => ({
                  productTitle: r.productTitle,
                  rating: r.rating,
                  title: r.title ?? null,
                  body: r.body,
                  createdAt: r.createdAt,
                })),
              }
            : null,
        },
        featuredProductIds: shop.featuredProductIds ?? [],
  }
}

export type SellerVerification = {
  id: string
  kind: "contact" | "identity" | "business" | "brand_auth" | "fulfillment_proven"
  status: "pending" | "verified" | "revoked" | "expired"
  /** Buyer-facing line naming exactly what was checked. */
  meaning: string
  issuedAt: string | null
  expiresAt: string | null
}

/**
 * Decomposed verification evidence for one shop (Phase 3D read path).
 * Only earned (`verified`) badges surface to buyers; an empty (or failed)
 * read is valid — new sellers simply show no badges, never invented ones.
 */
export async function getSellerVerifications(slug: string): Promise<SellerVerification[]> {
  const handle = slug.trim()
  if (!handle) return []
  const base = getAlkemartApiUrl()
  try {
    const res = await fetch(
      `${base}/store/sellers/${encodeURIComponent(handle)}/verifications`,
      { headers: { Accept: "application/json" } },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { verifications?: unknown }
    if (!Array.isArray(data.verifications)) return []
    const out: SellerVerification[] = []
    for (const v of data.verifications) {
      if (!v || typeof v !== "object") continue
      const row = v as Record<string, unknown>
      if (typeof row.id !== "string") continue
      if (typeof row.kind !== "string" || typeof row.status !== "string") continue
      if (row.status !== "verified") continue
      out.push({
        id: row.id,
        kind: row.kind as SellerVerification["kind"],
        status: "verified",
        meaning: typeof row.meaning === "string" ? row.meaning : "",
        issuedAt: typeof row.issuedAt === "string" ? row.issuedAt : null,
        expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
      })
    }
    return out
  } catch {
    return []
  }
}

export type StoreCollection = {
  id: string
  sellerId: string
  name: string
  slug: string
  description: string | null
  imageUrl: string | null
  cards: StoreProductCard[]
}

function mapCollectionCard(c: Record<string, unknown>): StoreProductCard | null {
  const id = typeof c.productId === "string" ? c.productId : null
  const title = typeof c.title === "string" ? c.title.trim() : ""
  if (!id || !title) return null
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null
  const amount =
    typeof c.fromPricePesewas === "string" && c.fromPricePesewas !== ""
      ? (() => {
          try {
            return pesewasToMajor(Number(c.fromPricePesewas))
          } catch {
            return null
          }
        })()
      : null
  const sellerName = str(c.sellerName)
  return {
    id,
    title,
    thumbnail: str(c.imageUrl),
    amount,
    currencyCode: typeof c.currency === "string" ? c.currency : "ghs",
    seller: sellerName
      ? {
          id: str(c.sellerId),
          name: sellerName,
          handle: str(c.sellerHandle),
        }
      : null,
    offerCount: num(c.offerCount) ?? 0,
    ratingAvg: num(c.ratingAvg),
    ratingCount: num(c.ratingCount) ?? 0,
  }
}

function mapStoreCollection(item: unknown): StoreCollection | null {
  if (!item || typeof item !== "object") return null
  const row = item as Record<string, unknown>
  const c = row.collection as Record<string, unknown> | undefined
  if (!c || typeof c.id !== "string" || typeof c.name !== "string") return null
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null
  const cards: StoreProductCard[] = []
  if (Array.isArray(row.cards)) {
    for (const card of row.cards) {
      if (!card || typeof card !== "object") continue
      const mapped = mapCollectionCard(card as Record<string, unknown>)
      if (mapped) cards.push(mapped)
    }
  }
  return {
    id: c.id,
    sellerId: typeof c.sellerId === "string" ? c.sellerId : "",
    name: c.name,
    slug: typeof c.slug === "string" ? c.slug : "",
    description: str(c.description),
    imageUrl: str(c.imageUrl),
    cards,
  }
}

async function fetchCollections(path: string): Promise<StoreCollection[]> {
  const base = getAlkemartApiUrl()
  const res = await fetch(`${base}${path}`, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`collections ${res.status}`)
  const data = (await res.json()) as { items?: unknown }
  if (!Array.isArray(data.items)) return []
  const out: StoreCollection[] = []
  for (const item of data.items) {
    const mapped = mapStoreCollection(item)
    if (mapped) out.push(mapped)
  }
  return out
}

/**
 * Live buyer-visible shelves for one shop (Phase 4A). Empty when the shop
 * has none — the section hides, never renders placeholder shelves.
 */
export async function listStoreCollections(sellerId: string): Promise<StoreCollection[]> {
  const id = sellerId.trim()
  if (!id) return []
  try {
    return await fetchCollections(`/store/collections?seller_id=${encodeURIComponent(id)}`)
  } catch {
    return []
  }
}

/** One live shelf with its cards; null when unknown, draft, or out of window. */
export async function getStoreCollection(
  sellerId: string,
  collectionId: string,
): Promise<StoreCollection | null> {
  const id = sellerId.trim()
  const cid = collectionId.trim()
  if (!id || !cid) return null
  try {
    const base = getAlkemartApiUrl()
    const res = await fetch(
      `${base}/store/collections/${encodeURIComponent(cid)}?seller_id=${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } },
    )
    if (!res.ok) return null
    return mapStoreCollection(await res.json())
  } catch {
    return null
  }
}

/** "Delivers in 1–3 days" / the same-day band — null when the shop promised nothing. */
export function shopDeliveryText(shop: Pick<StoreVendor, "deliveryDays" | "deliveryMinutes">): string | null {
  const d = shop.deliveryDays
  if (d) return `Delivers in ${d.min === d.max ? d.min : `${d.min}–${d.max}`} day${d.max === 1 ? "" : "s"}`
  return deliveryLabel(shop.deliveryMinutes ?? null)
}


/** Never show a raw code like "greater_accra" — title-case anything still machine-shaped. */
function readableRegion(v: string | null): string | null {
  if (!v || !/[_-]/.test(v) || /\s/.test(v)) return v
  return v
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}
