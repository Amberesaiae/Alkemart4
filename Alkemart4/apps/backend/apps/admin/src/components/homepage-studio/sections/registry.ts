import type { ComponentType } from "react"
import type { HomeSection, HomeSectionType } from "@alkemart/shared/homepage"
import {
  Clock,
  GridFour,
  Lightning,
  Megaphone,
  ShieldCheck,
  SquaresFour,
  Stack,
  Storefront,
  Tag,
  TextAa,
} from "@phosphor-icons/react"

/**
 * One entry per section type — the Studio's single source of truth.
 *
 * Before this, a type's name, hint, accent, presets and default shape lived in
 * four parallel maps and two `switch` statements across four files. Adding a
 * tenth type meant editing all of them in lockstep, and nothing caught a
 * half-added type: a missing editor branch simply rendered blank at runtime.
 *
 * `Record<HomeSectionType, SectionModule>` makes an omission a compile error
 * instead. Add a type to `HOME_SECTION_TYPES` and this file stops building
 * until the type is genuinely finished.
 */

export type SectionPreset = {
  id: string
  label: string
  description: string
  build: () => HomeSection
}

export type SectionModule = {
  /** What an admin calls this, in the library and the outline. */
  label: string
  /** One line on what the placement is for — shown in the library. */
  hint: string
  accent: { icon: ComponentType<{ className?: string }>; chip: string }
  /**
   * Starting points, not blank forms. A single preset adds immediately;
   * several open a second step.
   */
  presets: (newSection: (type: HomeSectionType) => HomeSection) => SectionPreset[]
  /** The shape a brand-new section of this type lands with. */
  build: (id: string) => HomeSection
}

function base(id: string) {
  return { id, visible: true as const }
}

export const SECTION_REGISTRY: Record<HomeSectionType, SectionModule> = {
  promo_hero: {
    label: "Promo banner",
    hint: "One strong seasonal message above the fold.",
    accent: { icon: Megaphone, chip: "bg-tone-brand text-tone-brand-fg" },
    build: (id) => ({
      ...base(id),
      type: "promo_hero",
      title: "A brighter way to shop",
      subtitle: "Seasonal picks from sellers across Ghana.",
      body: "Discover useful finds from sellers across Ghana.",
      theme: "gold",
      layout: "split",
      action: { label: "Shop now", href: "/categories/all" },
    }),
    presets: (newSection) => [
      { id: "hero-split", label: "Seasonal hero", description: "Image beside the message.", build: () => newSection("promo_hero") },
      {
        id: "hero-band",
        label: "Full-width band",
        description: "Copy over a wide backdrop.",
        build: () => ({
          ...(newSection("promo_hero") as Extract<HomeSection, { type: "promo_hero" }>),
          layout: "band",
          theme: "black",
        }),
      },
    ],
  },

  promo_grid: {
    label: "Promo grid",
    hint: "Campaign tiles — Bento features the first tile large.",
    accent: { icon: GridFour, chip: "bg-tone-scarce-soft text-tone-scarce-ink" },
    build: (id) => ({
      ...base(id),
      type: "promo_grid",
      title: "Today on Alkemart",
      subtitle: "Curated campaigns.",
      columns: 2,
      theme: "white",
      variant: "cards",
      tiles: [{ id: `${id}-1`, title: "Featured collection", body: "Add campaign copy here.", href: "/categories/all" }],
    }),
    presets: (newSection) => [
      { id: "grid-cards", label: "Campaign cards", description: "Even grid of promotions.", build: () => newSection("promo_grid") },
      {
        id: "grid-bento",
        label: "Bento — one featured",
        description: "First tile large, the rest fill in.",
        build: () => {
          const b = newSection("promo_grid") as Extract<HomeSection, { type: "promo_grid" }>
          return {
            ...b,
            variant: "bento",
            columns: 3,
            tiles: [
              { id: `${b.id}-1`, title: "Headline campaign", body: "The one thing you want shoppers to see.", href: "/categories/all" },
              { id: `${b.id}-2`, title: "Second campaign", href: "/categories/all" },
              { id: `${b.id}-3`, title: "Third campaign", href: "/categories/all" },
            ],
          }
        },
      },
    ],
  },

  category_grid: {
    label: "Category banners",
    hint: "Category art — your image, your crop. No text is drawn over it.",
    accent: { icon: SquaresFour, chip: "bg-tone-success-soft text-tone-success-ink" },
    build: (id) => ({
      ...base(id),
      type: "category_grid",
      title: "Shop by category",
      subtitle: "Browse the departments buyers use most.",
      columns: 4,
      variant: "mosaic",
      ratio: "landscape",
      showAllLink: true,
      tiles: [],
    }),
    presets: (newSection) => [
      { id: "cat-mosaic", label: "Mosaic", description: "Two large tiles beside a stack.", build: () => newSection("category_grid") },
      {
        id: "cat-tiles",
        label: "Even tiles",
        description: "Equal grid of category art.",
        build: () => ({
          ...(newSection("category_grid") as Extract<HomeSection, { type: "category_grid" }>),
          variant: "tiles",
          ratio: "square",
          columns: 6,
        }),
      },
      {
        id: "cat-banner",
        label: "Wide banner strips",
        description: "Full-width 16:5 banners for a few departments.",
        build: () => ({
          ...(newSection("category_grid") as Extract<HomeSection, { type: "category_grid" }>),
          variant: "banner",
          ratio: "ultrawide",
          title: "Featured departments",
        }),
      },
      {
        id: "cat-rail",
        label: "Scroll rail",
        description: "Compact horizontal nav.",
        build: () => ({
          ...(newSection("category_grid") as Extract<HomeSection, { type: "category_grid" }>),
          variant: "rail",
          ratio: "square",
          subtitle: undefined,
          showAllLink: false,
        }),
      },
    ],
  },

  product_shelf: {
    label: "Product shelf",
    hint: "Hand-picked products, or a rule that fills itself per buyer and hour.",
    accent: { icon: Stack, chip: "bg-tone-info-soft text-tone-info-ink" },
    build: (id) => ({
      ...base(id),
      type: "product_shelf",
      title: "Fresh picks",
      subtitle: "Just landed from our sellers.",
      source: "featured",
      limit: 8,
      layout: "grid",
    }),
    presets: (newSection) => [
      { id: "shelf-featured", label: "Featured", description: "Admin-featured products.", build: () => newSection("product_shelf") },
      {
        id: "shelf-new",
        label: "New arrivals rail",
        description: "Latest listings as a scroll carousel.",
        build: () => ({
          ...(newSection("product_shelf") as Extract<HomeSection, { type: "product_shelf" }>),
          title: "New this week",
          subtitle: "Fresh from our sellers.",
          source: "latest",
          layout: "carousel",
          limit: 12,
        }),
      },
      {
        id: "shelf-category",
        label: "Category shelf",
        description: "Products from one department.",
        build: () => ({
          ...(newSection("product_shelf") as Extract<HomeSection, { type: "product_shelf" }>),
          title: "Top in this category",
          source: "category",
          limit: 4,
        }),
      },
      {
        id: "shelf-manual",
        label: "Hand-picked",
        description: "Explicit products, in your order.",
        build: () => ({
          ...(newSection("product_shelf") as Extract<HomeSection, { type: "product_shelf" }>),
          title: "Our picks",
          source: "manual",
          productIds: [],
          limit: 4,
        }),
      },
      {
        id: "shelf-most-ordered",
        label: "Most ordered",
        description: "Ranked by real orders. Fills itself.",
        build: () => ({
          ...(newSection("product_shelf") as Extract<HomeSection, { type: "product_shelf" }>),
          title: "Most ordered",
          subtitle: "What buyers come back for.",
          source: "most_ordered",
        }),
      },
      {
        id: "shelf-trending",
        label: "Trending this week",
        description: "Ranked by orders in the last 7 days.",
        build: () => ({
          ...(newSection("product_shelf") as Extract<HomeSection, { type: "product_shelf" }>),
          title: "Trending",
          subtitle: "Moving fast right now.",
          source: "trending",
        }),
      },
      {
        id: "shelf-daypart",
        label: "By time of day",
        description: "Breakfast, lunch, supper — swaps itself on the buyer's clock.",
        build: () => ({
          ...(newSection("product_shelf") as Extract<HomeSection, { type: "product_shelf" }>),
          title: "What's good right now",
          subtitle: undefined,
          source: "daypart",
          daypartCategoryIds: {},
        }),
      },
      {
        id: "shelf-near-me",
        label: "Near the buyer",
        description: "Only shops in the buyer's saved area.",
        build: () => ({
          ...(newSection("product_shelf") as Extract<HomeSection, { type: "product_shelf" }>),
          title: "Near you",
          subtitle: "From shops in your area.",
          source: "near_me",
        }),
      },
    ],
  },

  store_rail: {
    label: "Shop rail",
    hint: "A shelf of shops, not products — how a marketplace merchandises its vendors.",
    accent: { icon: Storefront, chip: "bg-tone-info-soft text-tone-info-ink" },
    build: (id) => ({
      ...base(id),
      type: "store_rail",
      title: "Top rated shops",
      subtitle: "Sellers buyers keep coming back to.",
      source: "top_rated",
      limit: 8,
      layout: "grid",
    }),
    presets: (newSection) => [
      { id: "stores-top", label: "Top rated", description: "Highest rated open shops.", build: () => newSection("store_rail") },
      {
        id: "stores-fastest",
        label: "Fastest delivery",
        description: "Shops with the shortest declared band.",
        build: () => ({
          ...(newSection("store_rail") as Extract<HomeSection, { type: "store_rail" }>),
          title: "Fastest delivery",
          subtitle: "Order now, get it soon.",
          source: "fastest",
        }),
      },
      {
        id: "stores-newest",
        label: "New shops",
        description: "Recently opened, in listing order.",
        build: () => ({
          ...(newSection("store_rail") as Extract<HomeSection, { type: "store_rail" }>),
          title: "New on Alkemart",
          subtitle: "Shops that just opened.",
          source: "newest",
        }),
      },
      {
        id: "stores-near",
        label: "Near the buyer",
        description: "Only shops in the buyer's saved area.",
        build: () => ({
          ...(newSection("store_rail") as Extract<HomeSection, { type: "store_rail" }>),
          title: "Shops near you",
          subtitle: undefined,
          source: "near_me",
        }),
      },
      {
        id: "stores-manual",
        label: "Hand-picked shops",
        description: "Explicit shop handles, in your order.",
        build: () => ({
          ...(newSection("store_rail") as Extract<HomeSection, { type: "store_rail" }>),
          title: "Shops we love",
          source: "manual",
          sellerHandles: [],
          limit: 4,
        }),
      },
    ],
  },

  promo_band: {
    label: "Promo band",
    hint: "Compact CTA strip for seller and service callouts.",
    accent: { icon: Tag, chip: "bg-tone-warning-soft text-tone-warning-ink" },
    build: (id) => ({
      ...base(id),
      type: "promo_band",
      title: "Sell on Alkemart",
      body: "Open a shop and list products for buyers nationwide.",
      theme: "gold",
      action: { label: "Start selling", href: "/sell" },
      secondaryAction: { label: "How selling works", href: "/sell" },
    }),
    presets: (newSection) => [
      { id: "band-default", label: "Callout band", description: "One message, up to two buttons.", build: () => newSection("promo_band") },
      {
        id: "band-delivery",
        label: "Delivery promise",
        description: "Service message with one action.",
        build: () => ({
          ...(newSection("promo_band") as Extract<HomeSection, { type: "promo_band" }>),
          title: "Delivery across Ghana",
          body: "Pick the delivery option that suits your order.",
          theme: "white",
          action: { label: "See delivery options", href: "/delivery" },
          secondaryAction: undefined,
        }),
      },
    ],
  },

  countdown_banner: {
    label: "Countdown deal",
    hint: "A deal with a deadline. The clock leads.",
    accent: { icon: Clock, chip: "bg-tone-danger-soft text-tone-danger-ink" },
    build: (id) => {
      const ends = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ends.setMinutes(0, 0, 0)
      return {
        ...base(id),
        type: "countdown_banner",
        eyebrow: "Limited time",
        title: "Week of deals",
        body: "Ends soon — shop before the clock runs out.",
        countdownTo: ends.toISOString(),
        theme: "black",
        action: { label: "Shop the deals", href: "/categories/all" },
      }
    },
    presets: (newSection) => [
      { id: "countdown-default", label: "Countdown", description: "A deadline with a live clock.", build: () => newSection("countdown_banner") },
      {
        id: "countdown-flash",
        label: "24-hour flash",
        description: "One-day urgency. Pair with a deal rail below it.",
        build: () => {
          const base = newSection("countdown_banner") as Extract<HomeSection, { type: "countdown_banner" }>
          const ends = new Date(Date.now() + 24 * 60 * 60 * 1000)
          return { ...base, eyebrow: "Today only", title: "Flash sale", body: "One day, hand-picked prices.", countdownTo: ends.toISOString(), theme: "gold" }
        },
      },
    ],
  },

  marquee: {
    label: "Announcement strip",
    hint: "Short announcements. Motion is optional and pausable.",
    accent: { icon: TextAa, chip: "bg-tone-neutral-soft text-tone-neutral-ink" },
    build: (id) => ({
      ...base(id),
      type: "marquee",
      items: [
        { id: `${id}-1`, label: "Delivery across Ghana" },
        { id: `${id}-2`, label: "Pay on delivery available" },
        { id: `${id}-3`, label: "Sell on Alkemart", href: "/sell" },
      ],
      theme: "gold",
      animated: true,
      speed: "normal",
    }),
    presets: (newSection) => [
      { id: "marquee-animated", label: "Scrolling strip", description: "Moves, with a pause control.", build: () => newSection("marquee") },
      {
        id: "marquee-static",
        label: "Static strip",
        description: "No motion at all.",
        build: () => ({
          ...(newSection("marquee") as Extract<HomeSection, { type: "marquee" }>),
          animated: false,
        }),
      },
    ],
  },

  deal_rail: {
    label: "Deal rail",
    hint: "Products with campaign framing — badge and optional clock.",
    accent: { icon: Lightning, chip: "bg-tone-scarce text-tone-scarce-fg" },
    build: (id) => ({
      ...base(id),
      type: "deal_rail",
      title: "Flash deals",
      subtitle: "Moving fast this week.",
      eyebrow: "Deals",
      badge: "Deal",
      source: "featured",
      limit: 8,
    }),
    presets: (newSection) => [
      { id: "deal-featured", label: "Featured deals", description: "Admin-featured products.", build: () => newSection("deal_rail") },
      {
        id: "deals-clock",
        label: "Deals with a clock",
        description: "Adds a countdown to the rail header.",
        build: () => {
          const base = newSection("deal_rail") as Extract<HomeSection, { type: "deal_rail" }>
          const ends = new Date(Date.now() + 24 * 60 * 60 * 1000)
          return { ...base, title: "Ending today", countdownTo: ends.toISOString(), badge: "Ends today" }
        },
      },
      {
        id: "deals-trending",
        label: "Trending deals",
        description: "Ranked by orders in the last 7 days.",
        build: () => ({
          ...(newSection("deal_rail") as Extract<HomeSection, { type: "deal_rail" }>),
          title: "Moving this week",
          source: "trending",
        }),
      },
    ],
  },

  value_grid: {
    label: "Value grid",
    hint: "Trust messages: delivery, payment, sellers.",
    accent: { icon: ShieldCheck, chip: "bg-tone-neutral text-tone-neutral-fg" },
    build: (id) => ({
      ...base(id),
      type: "value_grid",
      title: "Why shop Alkemart",
      items: [
        { id: `${id}-1`, title: "Local sellers", body: "Shop from businesses across Ghana." },
        { id: `${id}-2`, title: "Flexible delivery", body: "Choose an option that works for you." },
      ],
    }),
    presets: (newSection) => [
      { id: "value-default", label: "Trust messages", description: "Two to four short promises.", build: () => newSection("value_grid") },
    ],
  },
}

export const SECTION_TYPES = Object.keys(SECTION_REGISTRY) as HomeSectionType[]

export const sectionLabels = Object.fromEntries(
  SECTION_TYPES.map((type) => [type, SECTION_REGISTRY[type].label]),
) as Record<HomeSectionType, string>

export const sectionHints = Object.fromEntries(
  SECTION_TYPES.map((type) => [type, SECTION_REGISTRY[type].hint]),
) as Record<HomeSectionType, string>

export const sectionAccents = Object.fromEntries(
  SECTION_TYPES.map((type) => [type, SECTION_REGISTRY[type].accent]),
) as Record<HomeSectionType, SectionModule["accent"]>

export function newSection(type: HomeSectionType): HomeSection {
  const id = `${type}-${crypto.randomUUID().slice(0, 8)}`
  return SECTION_REGISTRY[type].build(id)
}

export const sectionPresets: Record<HomeSectionType, SectionPreset[]> = Object.fromEntries(
  SECTION_TYPES.map((type) => [type, SECTION_REGISTRY[type].presets(newSection)]),
) as Record<HomeSectionType, SectionPreset[]>
