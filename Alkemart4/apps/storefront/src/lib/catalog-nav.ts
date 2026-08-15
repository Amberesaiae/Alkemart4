/**
 * Canonical catalog taxonomy for navigation.
 *
 * Single source of truth: every handle that ships in the marketplace maps to
 * one display label + one icon + optional mosaic art. Rail, mosaic, offer tabs
 * and PLP all derive from CATEGORY_META — no per-component regex tables.
 *
 * Data is API-only: resolvers never invent categories. Unlisted handles
 * (e.g. lab categories) still render with their real name and a generic icon.
 */
import { categoryIconId, type IconId } from "@/design/icons"

export type NavCategory = {
  id: string
  name: string
  handle?: string | null
  rank?: number | null
}

export type CategoryMeta = {
  /** Canonical short label for nav chips / tabs. */
  label: string
  icon: IconId
  /** Mosaic bento slot art (only categories with real photography). */
  mosaic?: {
    photo: string
    objectPos: string
    tall?: boolean
  }
}

/** Canonical handle → display metadata for every marketplace category. */
export const CATEGORY_META: Readonly<Record<string, CategoryMeta>> = {
  "phones-electronics": {
    label: "Electronics",
    icon: "cat-electronics",
    mosaic: {
      photo: "/images/categories/electronics.webp",
      objectPos: "object-center",
      tall: false,
    },
  },
  "food-groceries": {
    label: "Food",
    icon: "cat-food",
    mosaic: {
      photo: "/images/categories/food.webp",
      objectPos: "object-center",
      tall: true,
    },
  },
  beverages: {
    label: "Beverages",
    icon: "cat-beverages",
  },
  "health-beauty": {
    label: "Personal Care",
    icon: "cat-personal-care",
    mosaic: {
      photo: "/images/categories/cosmetics.webp",
      objectPos: "object-[center_20%]",
      tall: false,
    },
  },
  "pet-care": {
    label: "Pet Care",
    icon: "cat-pet-care",
    mosaic: {
      photo: "/images/categories/pets.webp",
      objectPos: "object-[center_15%]",
      tall: true,
    },
  },
  "baby-kids": {
    label: "Baby Care",
    icon: "cat-baby",
  },
  "fashion-apparel": {
    label: "Fashion & Apparel",
    icon: "cat-fashion",
  },
  "home-living": {
    label: "Home & Living",
    icon: "cat-home",
  },
  agriculture: {
    label: "Agriculture",
    icon: "cat-all",
  },
  automotive: {
    label: "Automotive",
    icon: "cat-all",
  },
  services: {
    label: "Services",
    icon: "cat-all",
  },
  other: {
    label: "Other",
    icon: "cat-all",
  },
}

export function metaFor(handle?: string | null): CategoryMeta | undefined {
  if (!handle) return undefined
  return CATEGORY_META[handle.toLowerCase()]
}

export function iconForCategory(
  name: string,
  handle?: string | null,
): IconId {
  return metaFor(handle)?.icon ?? categoryIconId(name, handle)
}

export type RailCategory = {
  id: string
  name: string
  handle?: string | null
  icon: IconId
}

/**
 * Department rail — every real top-level category, in rank order.
 * Label/icon from CATEGORY_META when the handle is canonical, otherwise the
 * category's real API name with a generic icon. Never invents rows.
 */
export function resolveRailCategories(api: NavCategory[]): RailCategory[] {
  if (!api.length) return []
  const ranked = [...api].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  return ranked
    .filter((c) => c.id && c.name)
    .map((c) => ({
      id: c.id,
      name: metaFor(c.handle)?.label ?? c.name,
      handle: c.handle ?? null,
      icon: iconForCategory(c.name, c.handle),
    }))
}

export type MosaicTile = {
  id: string
  slug: string
  title: string
  photo: string
  objectPos: string
  tall: boolean
}

/**
 * Home mosaic — real categories with real photography, in a fixed bento
 * composition (pet + food tall, cosmetics + electronics short). Skips handles
 * that are missing from the API; never swaps art for unrelated categories.
 */
export function resolveMosaicTiles(
  api: NavCategory[],
  order: readonly string[] = [
    "pet-care",
    "food-groceries",
    "health-beauty",
    "phones-electronics",
  ],
): MosaicTile[] {
  if (!api.length) return []
  const byHandle = new Map(
    api
      .filter((c) => c.handle)
      .map((c) => [(c.handle || "").toLowerCase(), c] as const),
  )
  const tiles: MosaicTile[] = []
  const used = new Set<string>()
  for (const h of order) {
    const meta = metaFor(h)
    const cat = byHandle.get(h)
    if (!meta?.mosaic || !cat || used.has(cat.id)) continue
    used.add(cat.id)
    tiles.push({
      id: cat.id,
      slug: cat.handle || cat.id,
      title: meta.label,
      photo: meta.mosaic.photo,
      objectPos: meta.mosaic.objectPos,
      tall: meta.mosaic.tall ?? false,
    })
  }
  return tiles
}

export function resolveBrowseCategory(
  api: NavCategory[],
  slug: string,
): NavCategory | null {
  const s = slug.trim().toLowerCase()
  if (!s || s === "all") return null
  return (
    api.find((c) => (c.handle || "").toLowerCase() === s) ||
    api.find((c) => c.name.toLowerCase() === s) ||
    null
  )
}
