/**
 * Static homepage section configs used when homepage CMS is offline.
 * Rails pull live products from Medusa — no invented prices.
 * Copy and module order: Ghana marketplace (Phase 3 redesign).
 * Palette stays yellow / white / black (tokens in index.css).
 */

export type FallbackHomepageSection = {
  id: number
  type:
    | "announcement_yellow"
    | "hero"
    | "product_rail"
    | "category_row"
    | "express_band"
    | "feature_grid"
    | "seller_cta"
  sortOrder: number
  enabled: boolean
  config: Record<string, unknown>
  imageUrl?: string | null
}

/**
 * Ghana home modules (priority from redesign plan):
 * 1. Promo strip → 2. Hero → 3. Categories → 4. Market rail
 * 5. Trust tiles → 6. More products → 7. Delivery honesty → 8. Seller CTA
 * Empty product rails render honest empty states — never stub prices.
 */
export const DEFAULT_HOMEPAGE_SECTIONS: FallbackHomepageSection[] = [
  {
    id: 1,
    type: "announcement_yellow",
    sortOrder: 0,
    enabled: true,
    config: {
      headline: "Lab demo · Cash on delivery · GHS prices",
      cta: "Shop now",
      ctaTo: "/browse/all",
    },
  },
  {
    id: 2,
    type: "hero",
    sortOrder: 1,
    enabled: true,
    config: {
      eyebrow: "alkemart Ghana · lab",
      title: "Shop local vendors. Checkout with cash on delivery.",
      subtitle:
        "Marketplace lab for Ghana — GHS prices, thin live catalog, cash on delivery. Not a production payment system.",
      cta: "Browse the market",
      ctaTo: "/browse/all",
    },
  },
  {
    id: 3,
    type: "category_row",
    sortOrder: 2,
    enabled: true,
    config: {
      title: "Shop by category",
      linkTo: "/browse/all",
    },
  },
  {
    id: 4,
    type: "product_rail",
    sortOrder: 3,
    enabled: true,
    config: {
      title: "Today’s market",
      linkTo: "/browse/all",
      count: 8,
      columns: 4,
      showAdd: true,
    },
  },
  {
    id: 5,
    type: "feature_grid",
    sortOrder: 4,
    enabled: true,
    config: {
      items: [
        {
          id: "cod",
          icon: "COD",
          title: "Cash on delivery",
          description:
            "Supported lab checkout: pay the rider when the order arrives.",
        },
        {
          id: "vendors",
          icon: "Sellers",
          title: "Ghana vendors (lab)",
          description:
            "Listings come from the marketplace API. Catalog may be thin in this demo.",
        },
        {
          id: "delivery",
          icon: "Delivery",
          title: "Seller shipping",
          description:
            "Options depend on the seller and your area — attached at checkout.",
        },
        {
          id: "ghs",
          icon: "GHS",
          title: "Prices in Ghana cedis",
          description:
            "Shop and checkout in GHS. Lab references are not formal receipts.",
        },
      ],
    },
  },
  {
    id: 6,
    type: "product_rail",
    sortOrder: 5,
    enabled: true,
    config: {
      title: "More to explore",
      linkTo: "/browse/all",
      count: 8,
      columns: 4,
      showAdd: true,
    },
  },
  {
    id: 7,
    type: "express_band",
    sortOrder: 6,
    enabled: true,
    config: {
      headline: "Delivery across Ghana",
      subtext:
        "See available options for your address at checkout — we never invent same-day promises.",
    },
  },
  {
    id: 8,
    type: "seller_cta",
    sortOrder: 7,
    enabled: true,
    config: {
      eyebrow: "Sell on alkemart",
      title: "List your products for Ghana shoppers",
      body: "Open the Seller Hub to register your store, manage catalog, and fulfill orders. Buyer storefront stays here; seller tools live in Mercur.",
      cta: "Open Seller Hub",
    },
  },
]
