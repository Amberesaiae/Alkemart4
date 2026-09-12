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
      variant?: "tiles" | "mosaic" | "rail"
      showAllLink?: boolean
      categoryIds: string[]
    } & HomeVisibility
  | {
      id: string
      type: "product_shelf"
      title: string
      subtitle?: string
      source: "featured" | "latest" | "category" | "manual"
      categoryId?: string
      /** Manual curation: explicit product IDs in display order. */
      productIds?: string[]
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
  | {
      id: string
      type: "value_grid"
      title?: string
      subtitle?: string
      items: Array<{ id: string; title: string; body: string }>
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

export const HOME_SECTION_TYPES = [
  "promo_hero",
  "promo_grid",
  "category_grid",
  "product_shelf",
  "promo_band",
  "value_grid",
] as const

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number]

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
    variant: "tiles",
    showAllLink: true,
    categoryIds: [],
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
