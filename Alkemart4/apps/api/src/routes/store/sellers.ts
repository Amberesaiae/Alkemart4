import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"
import { trackView } from "../../traffic"
import type { SellerShopTrust } from "../../catalog-repository"
import type { ReviewRow } from "../../checkout-repository"
import { contactFromMetadata, storefrontFromMetadata } from "../vendor/sellers"

export const sellers = new Hono<AppEnv>()
  .get("/", async (c) => {
    const sellersList = await c.get("repo").listOpenSellers()
    return c.json({
      sellers: sellersList,
      items: sellersList,
    })
  })
  .get("/:handle", async (c) => {    const shop = await c.get("repo").getSellerShop(c.req.param("handle"))
    if (!shop) throw new HTTPException(404, { message: "seller not found" })
    // Fire-and-forget traffic counter; reads never wait on it.
    trackView(c, shop.seller.id, null)
    const featuredProductIds = await c.get("featured").listFeatured(shop.seller.id).catch(() => [])
    // Branding lives on the seller profile (logo/banner/bio), not the
    // catalog snapshot — attach it so shop heroes render real art.
    const profile = await c.get("authRepo").findSellerById(shop.seller.id).catch(() => null)
    const trust = await assembleShopTrust(c, shop.seller.id, shop.items, {
      createdAt: profile?.createdAt ?? null,
      packRegion: profile?.packRegion ?? null,
      metadata: profile?.metadata ?? null,
    }).catch(() => null)
    return c.json({
      ...shop,
      seller: {
        ...shop.seller,
        description: profile?.description ?? null,
        logo: profile?.logo ?? null,
        banner: profile?.banner ?? null,
        trust,
      },
      featuredProductIds,
    })
  })

type ShopTrustProfile = {
  createdAt: Date | null
  packRegion: string | null
  metadata: Record<string, unknown> | null
}

/**
 * Trust bundle for the shop hero: ratings, sales, freshness, contact,
 * announcement, policy, recent reviews. Every source is individually
 * guarded — the shop page must render even when a source is down.
 */
async function assembleShopTrust(
  c: {
    get(k: "checkoutRepo"): AppEnv["Variables"]["checkoutRepo"]
    get(k: "policies"): AppEnv["Variables"]["policies"]
  },
  sellerId: string,
  items: { productId: string; title: string }[],
  profile: ShopTrustProfile,
): Promise<SellerShopTrust> {
  const [reviews, totals, policy] = await Promise.all([
    c.get("checkoutRepo").listReviewsBySeller(sellerId).catch((): ReviewRow[] => []),
    c.get("checkoutRepo").orderTotalsBySeller().catch(() => new Map<string, { orders: number }>()),
    c.get("policies").currentPolicy(sellerId).catch(() => null),
  ])
  const published = reviews.filter((r) => r.status === "published")
  const ratingCount = published.length
  const ratingAvg =
    ratingCount > 0
      ? Math.round((published.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10
      : null
  const titles = new Map(items.map((i) => [i.productId, i.title]))
  const recentReviews = [...published]
    .sort((a, b) => +b.createdAt - +a.createdAt)
    .slice(0, 3)
    .map((r) => ({
      productTitle: titles.get(r.productId) ?? "Item",
      rating: r.rating,
      title: r.title,
      body: r.body.length > 220 ? r.body.slice(0, 217).trimEnd() + "…" : r.body,
      createdAt: r.createdAt.toISOString(),
    }))
  const contact = contactFromMetadata(profile.metadata)
  const storefront = storefrontFromMetadata(profile.metadata)
  return {
    ratingAvg,
    ratingCount,
    salesCount: totals.get(sellerId)?.orders ?? 0,
    memberSince: profile.createdAt instanceof Date ? profile.createdAt.toISOString() : null,
    location: profile.packRegion,
    tagline: storefront.tagline,
    phone: contact.phone,
    hours: contact.hours,
    social: contact.social,
    announcement: storefront.announcementActive ? storefront.announcement!.text : null,
    policy: policy ? { ...policy.body } : null,
    recentReviews,
  }
}
