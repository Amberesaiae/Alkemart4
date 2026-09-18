export type HomeTheme = "white" | "gold" | "black"

export type HomeLink = {
  label: string
  href: string
}

/**
 * Per-section merchandising controls.
 *
 * Page-level draft/published/scheduled stays the source of truth for the
 * public snapshot (see docs/architecture/homepage-merchandising.md).
 * These per-section fields let admins run seasonal campaigns without
 * republishing the whole page:
 * - `visible`: quick hide without deleting the section.
 * - `startsAt` / `endsAt`: ISO datetimes; section renders only in-window.
 */
export type HomeVisibility = {
  visible?: boolean
  startsAt?: string | null
  endsAt?: string | null
}

export type HomeTile = {
  id: string
  title: string
  eyebrow?: string
  body?: string
  imageUrl?: string
  href: string
}

/**
 * Category banner tiles.
 *
 * A tile is a *banner*, not a product card: the art is the surface and the
 * caption sits below it in body type. Admins pick the catalogue category, then
 * override the image, crop and copy per placement — seasonal art without a
 * code change.
 * When `imageUrl` is absent the storefront falls back to the canonical
 * category photography, so an unconfigured tile is still honest.
 */
export type CategoryBannerTile = {
  categoryId: string
  /** Banner art. Absent means "use the canonical category photo". */
  imageUrl?: string
  /** CSS object-position, e.g. "center", "top", "50% 30%". */
  focalPoint?: string
  /** Overrides the catalogue category name on the banner. */
  label?: string
  /** Small line above the label, e.g. "Up to 40% off". */
  eyebrow?: string
  /** Corner flag, e.g. "New" or "Flash". */
  badge?: string
  /** `feature` tiles take the large cells in mosaic/banner layouts. */
  slot?: CategoryTileSlot
}

export type CategoryTileSlot = "feature" | "standard"

export type CategoryVariant = "tiles" | "mosaic" | "rail" | "banner"

/**
 * Banner proportions. Sizing is a ratio, never a fixed height — that is what
 * keeps a category banner from growing into an oversized product card.
 * Each variant has a sensible default (see `categoryRatioOf`); this overrides it.
 */
export type CategoryRatio = "square" | "landscape" | "wide" | "ultrawide"

export const CATEGORY_RATIOS: readonly CategoryRatio[] = ["square", "landscape", "wide", "ultrawide"]

export type HomeSection =
  | {
      id: string
      type: "promo_hero"
      eyebrow?: string
      title: string
      subtitle?: string
      body?: string
      imageUrl?: string
      action?: HomeLink
      theme: HomeTheme
      layout?: "split" | "band"
    } & HomeVisibility
  | {
      id: string
      type: "promo_grid"
      title?: string
      subtitle?: string
      columns: 2 | 3 | 4
      theme: HomeTheme
      variant?: "cards" | "bento"
      tiles: HomeTile[]
    } & HomeVisibility
  | {
      id: string
      type: "category_grid"
      title: string
      subtitle?: string
      columns: 4 | 6 | 8
      variant?: CategoryVariant
      ratio?: CategoryRatio
      showAllLink?: boolean
      tiles: CategoryBannerTile[]
      /** @deprecated Pre-banner shape. Read through `categoryTilesOf()`. */
      categoryIds?: string[]
    } & HomeVisibility
  | {
      id: string
      type: "product_shelf"
      title: string
      subtitle?: string
      source: HomeShelfSource
      categoryId?: string
      /** Manual curation: explicit product IDs in display order. */
      productIds?: string[]
      /**
       * `daypart` source: which category leads at each part of the day.
       * A daypart with no category configured renders the section empty
       * rather than falling back to an unrelated shelf.
       */
      daypartCategoryIds?: Partial<Record<Daypart, string>>
      limit: 4 | 8 | 12
      layout?: "grid" | "carousel"
    } & HomeVisibility
  | {
      id: string
      type: "promo_band"
      eyebrow?: string
      title: string
      body?: string
      imageUrl?: string
      action?: HomeLink
      secondaryAction?: HomeLink
      theme: HomeTheme
    } & HomeVisibility
  | ({
      id: string
      type: "countdown_banner"
      eyebrow?: string
      title: string
      body?: string
      /** ISO datetime the clock counts down to. */
      countdownTo: string
      /** Copy shown once the clock reaches zero, if the section is still up. */
      expiredLabel?: string
      imageUrl?: string
      action?: HomeLink
      theme: HomeTheme
    } & HomeVisibility)
  | ({
      id: string
      type: "marquee"
      items: Array<{ id: string; label: string; href?: string }>
      theme: HomeTheme
      /** Auto-scroll. Paired with a pause control and a static reduced-motion fallback. */
      animated?: boolean
      speed?: "slow" | "normal"
    } & HomeVisibility)
  | ({
      id: string
      type: "deal_rail"
      title: string
      subtitle?: string
      eyebrow?: string
      /** Flag stamped on every card, e.g. "Flash deal". */
      badge?: string
      source: HomeShelfSource
      categoryId?: string
      productIds?: string[]
      limit: 4 | 8 | 12
      /** Optional clock in the section header. */
      countdownTo?: string
    } & HomeVisibility)
  | {
      id: string
      type: "value_grid"
      title?: string
      subtitle?: string
      items: Array<{ id: string; title: string; body: string }>
    } & HomeVisibility
  | {
      id: string
      /**
       * A shelf of *shops* rather than products.
       *
       * A multi-vendor marketplace has to merchandise its vendors, and no
       * product shelf can express that. Sources are rules, not picks, except
       * `manual`, which takes shop handles in order.
       */
      type: "store_rail"
      title: string
      subtitle?: string
      source: "top_rated" | "fastest" | "newest" | "near_me" | "manual"
      /** Manual curation: shop handles in display order. */
      sellerHandles?: string[]
      limit: 4 | 8 | 12
      layout?: "grid" | "carousel"
    } & HomeVisibility

export type HomepageDocument = {
  key: "homepage"
  revision: number
  sections: HomeSection[]
  status: "draft" | "published" | "scheduled"
  publishAt: string | null
  unpublishAt: string | null
  updatedAt: string
}

/**
 * Where a shelf's products come from.
 *
 * The first four are curated: a person picks. The rest are *rules* — the same
 * configured section resolves differently per buyer and per hour, which is
 * how a homepage merchandises itself instead of waiting to be filled in.
 *
 *  most_ordered — units sold, all time
 *  trending     — units sold in the last 7 days
 *  daypart      — a category keyed to the buyer's local hour
 *  near_me      — limited to shops in the buyer's saved area
 */
export const HOME_SHELF_SOURCES = [
  "featured",
  "latest",
  "category",
  "manual",
  "most_ordered",
  "trending",
  "daypart",
  "near_me",
] as const

export type HomeShelfSource = (typeof HOME_SHELF_SOURCES)[number]

/** Sources that resolve from a rule rather than a person's picks. */
export function isRuleSource(source: HomeShelfSource): boolean {
  return source === "most_ordered" || source === "trending" || source === "daypart" || source === "near_me"
}

/**
 * Which daypart the buyer is in, from their own clock.
 *
 * Deliberately coarse and local — a "What's for lunch" shelf is wrong if it
 * reads the server's timezone, and Ghana's trading day does not need finer
 * granularity than this.
 */
export type Daypart = "breakfast" | "lunch" | "supper" | "late"

export function currentDaypart(now: Date): Daypart {
  const h = now.getHours()
  if (h >= 5 && h < 11) return "breakfast"
  if (h >= 11 && h < 16) return "lunch"
  if (h >= 16 && h < 22) return "supper"
  return "late"
}

export const DAYPART_LABEL: Record<Daypart, string> = {
  breakfast: "What's for breakfast",
  lunch: "What's for lunch",
  supper: "What's for supper",
  late: "Open late",
}

export const HOME_SECTION_TYPES = [
  "promo_hero",
  "promo_grid",
  "category_grid",
  "product_shelf",
  "promo_band",
  "countdown_banner",
  "marquee",
  "deal_rail",
  "value_grid",
  "store_rail",
] as const

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number]

export type CategorySection = Extract<HomeSection, { type: "category_grid" }>

/**
 * Tiles for a category section, tolerating the pre-banner `categoryIds` shape.
 * Legacy documents gain the mosaic hierarchy for free: the first two entries
 * become feature tiles, matching the original hand-built homepage mosaic.
 */
export function categoryTilesOf(section: CategorySection): CategoryBannerTile[] {
  if (section.tiles?.length) return section.tiles
  return (section.categoryIds ?? []).map((categoryId, index) => ({
    categoryId,
    slot: index < 2 ? "feature" : "standard",
  }))
}

/** Default proportions per layout. Mosaic/banner lead with landscape art. */
export function categoryRatioOf(section: CategorySection): CategoryRatio {
  if (section.ratio) return section.ratio
  if (section.variant === "rail") return "square"
  if (section.variant === "banner") return "ultrawide"
  if (section.variant === "mosaic") return "landscape"
  return "square"
}

/**
 * Forward-migrates stored documents on read, so a draft saved before banners
 * existed renders (and edits) as tiles without a database migration.
 */
export function migrateSections(sections: HomeSection[]): HomeSection[] {
  return sections.map((section) => {
    if (section.type !== "category_grid") return section
    if (section.tiles?.length || !(section.categoryIds ?? []).length) {
      return { ...section, tiles: section.tiles ?? [] }
    }
    const { categoryIds: _legacy, ...rest } = section
    return { ...rest, tiles: categoryTilesOf(section) }
  })
}

/**
 * Milliseconds until `iso`, floored at zero. Returns null for an unusable date
 * so callers can hide a clock rather than render a broken one.
 */
export function timeRemaining(iso: string, now: Date = new Date()): number | null {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return null
  return Math.max(0, target.getTime() - now.getTime())
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number }

export function countdownParts(ms: number): CountdownParts {
  const seconds = Math.floor(ms / 1000)
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  }
}

export function isSectionVisible(section: HomeSection, now: Date = new Date()): boolean {
  if (section.visible === false) return false
  if (section.startsAt) {
    const start = new Date(section.startsAt)
    if (!Number.isNaN(start.getTime()) && start > now) return false
  }
  if (section.endsAt) {
    const end = new Date(section.endsAt)
    if (!Number.isNaN(end.getTime()) && end <= now) return false
  }
  return true
}

export function visibleSections(sections: HomeSection[], now: Date = new Date()): HomeSection[] {
  return sections.filter((section) => isSectionVisible(section, now))
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomeSection[] = [
  {
    id: "categories",
    type: "category_grid",
    title: "Shop by category",
    subtitle: "Browse the departments buyers use most.",
    columns: 4,
    variant: "mosaic",
    showAllLink: true,
    tiles: [],
  },
  {
    id: "fresh-picks",
    type: "product_shelf",
    title: "Fresh picks",
    subtitle: "Just landed from our sellers.",
    source: "featured",
    limit: 8,
    layout: "grid",
  },
]
