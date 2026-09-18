import { getAlkemartApiUrl, getBackendUrl, getPublishableKey } from "./env"
import { getSellerShop, setBaseUrl } from "./api-client"
import type { StorefrontBadge } from "@alkemart/shared/storefront-badges"
import type { StoreCardFeatured } from "@workspace/ui"

function ensureWorkersBaseUrl() {
  const url = getAlkemartApiUrl()
  if (!url) throw new Error("VITE_ALKEMART_API_URL is not set")
  setBaseUrl(url)
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
  availability?: "open" | "paused"
  ratingAvg?: number | null
  ratingCount?: number
  salesCount?: number
  deliveryMinutes?: number | null
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
    location: str(v.location),
    availability: v.availability === "paused" ? "paused" : "open",
    ratingAvg: num(v.ratingAvg),
    ratingCount: num(v.ratingCount) ?? 0,
    salesCount: num(v.salesCount) ?? 0,
    deliveryMinutes: num(v.deliveryMinutes),
    badges,
    featured,
  }
}

function useWorkersVendors(): boolean {
  return Boolean(getAlkemartApiUrl())
}

/**
 * List marketplace vendors when the store exposes them.
 * Empty array if endpoint missing or empty — never invents sellers.
 */
export async function listStoreVendors(): Promise<StoreVendor[]> {
  if (useWorkersVendors()) {
    ensureWorkersBaseUrl()
    const base = getAlkemartApiUrl()
    try {
      const res = await fetch(`${base}/store/sellers`, {
        headers: { Accept: "application/json" },
      })
      if (!res.ok) return []
      const data = (await res.json()) as Record<string, unknown>
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
    } catch {
      return []
    }
  }

  const base = getBackendUrl()
  const pk = getPublishableKey()
  const paths = [
    `${base}/store/alkemart/vendors`,
    `${base}/store/sellers`,
  ]

  for (const url of paths) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "x-publishable-api-key": pk,
        },
      })
      if (!res.ok) continue
      const data = (await res.json()) as Record<string, unknown>
      const raw =
        (data.vendors as Record<string, unknown>[] | undefined) ??
        (data.sellers as Record<string, unknown>[] | undefined) ??
        (Array.isArray(data) ? (data as Record<string, unknown>[]) : [])
      const mapped: StoreVendor[] = []
      for (const v of raw) {
        const card = toStoreVendor(v)
        if (card) mapped.push(card)
      }
      if (mapped.length) return mapped
    } catch {
      /* try next path */
    }
  }
  return []
}

export type StoreVendorDetail = {
  id: string
  name: string
  slug: string
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
  /** Computed, never vendor-typed. */
  badges?: StorefrontBadge[]
  status?: string
  availability?: { state: "open" | "paused"; pausedUntil: string | null; note: string | null }
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

/** Shop hero for /shops/$slug — Workers seller shop or Medusa alkemart vendor. */
export async function getStoreVendorBySlug(slug: string): Promise<{
  vendor: StoreVendorDetail
  featuredProductIds: string[]
}> {
  if (useWorkersVendors()) {
    ensureWorkersBaseUrl()
    try {
      const shop = await getSellerShop(slug)
      return {
        vendor: {
          id: shop.seller.id,
          name: shop.seller.name,
          slug: shop.seller.handle,
          bio: shop.seller.description ?? null,
          logoImageUrl: shop.seller.logo ?? null,
          coverImageUrl: shop.seller.banner ?? null,
          availability: shop.seller.availability,
          trust: shop.seller.trust
            ? {
                ratingAvg: shop.seller.trust.ratingAvg ?? null,
                ratingCount: shop.seller.trust.ratingCount ?? 0,
                salesCount: shop.seller.trust.salesCount ?? 0,
                memberSince: shop.seller.trust.memberSince ?? null,
                location: shop.seller.trust.location ?? null,
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
    } catch {
      throw new Error("Store not found")
    }
  }

  const base = getBackendUrl()
  const pk = getPublishableKey()
  const res = await fetch(
    `${base}/store/alkemart/vendors/${encodeURIComponent(slug)}`,
    {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": pk,
      },
    },
  )
  if (res.status === 404) throw new Error("Store not found")
  if (!res.ok) throw new Error(`Failed to load store (${res.status})`)
  const data = (await res.json()) as { vendor?: Partial<StoreVendorDetail> & { id?: string; name?: string } }
  if (!data.vendor?.id || !data.vendor.name) throw new Error("Store not found")
  return {
    vendor: {
      ...data.vendor,
      id: String(data.vendor.id),
      name: data.vendor.name,
      slug: data.vendor.slug ?? slug,
      bio: data.vendor.bio ?? null,
    },
    featuredProductIds: [],
  }
}
