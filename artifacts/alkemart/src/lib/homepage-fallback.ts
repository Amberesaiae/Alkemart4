/**
 * Static homepage section configs used when homepage CMS (Express/admin) is offline.
 * Rails pull live products from Medusa — no invented prices.
 * Production CMS should replace this via Medusa homepage module later.
 */

export type FallbackHomepageSection = {
  id: number
  type:
    | "announcement_yellow"
    | "hero"
    | "product_rail"
    | "category_row"
    | "express_band"
  sortOrder: number
  enabled: boolean
  config: Record<string, unknown>
  imageUrl?: string | null
}

/**
 * Honest storefront shell: hero + product rails from Medusa catalog.
 * Empty rails render empty states inside HomepageSectionList components.
 */
export const DEFAULT_HOMEPAGE_SECTIONS: FallbackHomepageSection[] = [
  {
    id: 1,
    type: "announcement_yellow",
    sortOrder: 0,
    enabled: true,
    config: {
      headline: "Shop Ghana — delivery options confirmed at checkout",
      cta: "Browse all",
      ctaTo: "/browse/all",
    },
  },
  {
    id: 2,
    type: "hero",
    sortOrder: 1,
    enabled: true,
    config: {
      eyebrow: "alkemart Ghana",
      title: "Everything you need, from local vendors",
      cta: "Shop now",
      ctaTo: "/browse/all",
    },
  },
  {
    id: 3,
    type: "product_rail",
    sortOrder: 2,
    enabled: true,
    config: {
      title: "Popular right now",
      linkTo: "/browse/all",
      count: 8,
      columns: 4,
      showAdd: true,
    },
  },
  {
    id: 4,
    type: "category_row",
    sortOrder: 3,
    enabled: true,
    config: {
      title: "Shop by category",
    },
  },
  {
    id: 5,
    type: "product_rail",
    sortOrder: 4,
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
    id: 6,
    type: "express_band",
    sortOrder: 5,
    enabled: true,
    config: {
      headline: "Fast delivery options at checkout",
      subtext: "See available options when you place your order — no invented ETAs.",
    },
  },
]
