import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { sellerBadges } from "@alkemart/shared/storefront-badges"
import type { AppEnv } from "../../context"
import { trackView } from "../../traffic"
import type { AuthSeller } from "../../auth-repository"
import type { ProductCardDto } from "@alkemart/domain"
import type { SellerShopTrust } from "../../catalog-repository"
import type { ReviewRow } from "../../checkout-repository"
import { contactFromMetadata, deliveryFromMetadata, storefrontFromMetadata } from "../vendor/sellers"

/** The slice of a product card a featured tile shows: art, name, price. */
type FeaturedCard = {
  productId: string
  title: string
  imageUrl: string | null
  fromPricePesewas: string
  offerCount: number
  handle: string
}

async function loadFeaturedProducts(
  c: { get(k: "repo"): AppEnv["Variables"]["repo"] },
  ids: Set<string>,
): Promise<Map<string, FeaturedCard>> {
  if (ids.size === 0) return new Map()
  const cards = await c
    .get("repo")
    .productCardsByIds([...ids])
    .catch(() => new Map<string, ProductCardDto>())
  const out = new Map<string, FeaturedCard>()
  for (const [id, card] of cards) {
    out.set(id, {
      productId: card.productId,
      title: card.title,
      imageUrl: card.imageUrl,
      fromPricePesewas: card.fromPricePesewas,
      offerCount: card.offerCount,
      handle: card.productId,
    })
  }
  return out
}

export const sellers = new Hono<AppEnv>()
  /**
   * Store cards for the Stores index.
   *
   * Everything a buyer needs to choose a shop without opening it: art, where
   * it is, what people rate it, how long it takes, whether it is open, and
   * the items the vendor themselves chose to lead with.
   *
   * Aggregates are batched — one review roll-up, one order roll-up, one
   * featured-picks read — because this page lists every open shop and a
   * per-shop query would be one round trip per card.
   */
  .get("/", async (c) => {
    const open = await c.get("repo").listOpenSellers()
    if (open.length === 0) return c.json({ sellers: [], items: [] })

    const ids = open.map((s) => s.id)
    const [profiles, reviewTotals, orderTotals, featuredByShop] = await Promise.all([
      c.get("authRepo").listSellers().catch((): AuthSeller[] => []),
      c
        .get("checkoutRepo")
        .reviewTotalsBySeller()
        .catch(() => new Map<string, { count: number; avg: number }>()),
      c
        .get("checkoutRepo")
        .orderTotalsBySeller()
        .catch(() => new Map<string, { orders: number }>()),
      c
        .get("featured")
        .listFeaturedForShops(ids)
        .catch(() => new Map<string, string[]>()),
    ])

    const profileById = new Map(profiles.map((p) => [p.id, p]))
    const now = new Date()

    // Featured picks are product ids; the cards need titles, art and price.
    const wantedProductIds = new Set<string>()
    for (const id of ids) {
      for (const pid of featuredByShop.get(id) ?? []) wantedProductIds.add(pid)
    }
    const productById = await loadFeaturedProducts(c, wantedProductIds)

    const cards = open.map((s) => {
      const profile = profileById.get(s.id) ?? null
      const meta = profile?.metadata ?? null
      const contact = contactFromMetadata(meta)
      const storefront = storefrontFromMetadata(meta)
      const delivery = deliveryFromMetadata(meta)
      const rating = reviewTotals.get(s.id) ?? null
      const availability = profile?.availability === "paused" ? "paused" : "open"
      const memberSince =
        profile?.createdAt instanceof Date ? profile.createdAt.toISOString() : null

      return {
        id: s.id,
        handle: s.handle,
        name: s.name,
        logo: profile?.logo ?? null,
        banner: profile?.banner ?? null,
        tagline: storefront.tagline,
        location: profile?.packRegion ?? null,
        availability,
        // Omitted rather than zeroed: a shop nobody has reviewed shows no
        // rating at all, so a real 4.6 stays worth reading.
        ratingAvg: rating && rating.count > 0 ? rating.avg : null,
        ratingCount: rating?.count ?? 0,
        salesCount: orderTotals.get(s.id)?.orders ?? 0,
        deliveryMinutes: delivery.minutes,
        hours: contact.hours,
        badges: sellerBadges(
          {
            ratingAvg: rating && rating.count > 0 ? rating.avg : null,
            ratingCount: rating?.count ?? 0,
            deliveryMinutes: delivery.minutes,
            hours: contact.hours,
            availability,
            memberSince,
          },
          now,
        ),
        featured: (featuredByShop.get(s.id) ?? [])
          .map((pid) => productById.get(pid))
          .filter((p): p is FeaturedCard => p != null),
      }
    })

    return c.json({ sellers: cards, items: cards })
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
    // The shop page and the stores index must agree about a shop, so both
    // read the same delivery band and the same computed badges.
    const delivery = deliveryFromMetadata(profile?.metadata ?? null)
    const availability = shop.seller.availability.state
    const badges = sellerBadges(
      {
        ratingAvg: trust?.ratingAvg ?? null,
        ratingCount: trust?.ratingCount ?? 0,
        deliveryMinutes: delivery.minutes,
        hours: trust?.hours ?? null,
        availability,
        memberSince: trust?.memberSince ?? null,
      },
      new Date(),
    )
    return c.json({
      ...shop,
      seller: {
        ...shop.seller,
        description: profile?.description ?? null,
        logo: profile?.logo ?? null,
        banner: profile?.banner ?? null,
        deliveryMinutes: delivery.minutes,
        badges,
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
