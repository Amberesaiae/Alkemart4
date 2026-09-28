import { getAlkemartApiUrl } from "./env"
import { ensureApiBaseUrl, getSellerShop } from "./api"
import type { StorefrontBadge } from "@alkemart/shared/storefront-badges"
import type { StoreCardFeatured } from "@workspace/ui"

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

/**
 * List marketplace vendors. Empty array when the endpoint is missing or
 * empty — never invents sellers (honesty gate).
 */
export async function listStoreVendors(): Promise<StoreVendor[]> {
  if (!getAlkemartApiUrl()) return []
  ensureApiBaseUrl()
  try {
    const res = await fetch(`${getAlkemartApiUrl()}/store/sellers`, {
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

export type StoreVendorDetail = {
  id: string
  name: string
  slug: string
  bio?: string | null
  logoImageUrl?: string | null
  coverImageUrl?: string | null
  logoThumbUrl?: string | null
  coverWebUrl?: string | null
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

/** Shop hero for /shops/$slug — same contract as production storefront. */
export async function getStoreVendorBySlug(slug: string): Promise<{
  vendor: StoreVendorDetail
  featuredProductIds: string[]
}> {
  ensureApiBaseUrl()
  if (!getAlkemartApiUrl()) throw new Error("VITE_ALKEMART_API_URL is not set")
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
