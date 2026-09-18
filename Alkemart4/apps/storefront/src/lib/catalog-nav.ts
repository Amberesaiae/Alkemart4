/**
 * Category presentation helpers (icons / mosaic art by handle).
 *
 * Display names come from the API (`NavCategory.name`). CATEGORY_META may
 * only supply icon + mosaic art — never a parallel rename table for labels.
 */
import { categoryArtFor } from "@alkemart/shared/category-art"
import { categoryIconId, type IconId } from "@/design/icons"

export type NavCategory = {
  id: string
  name: string
  handle?: string | null
  rank?: number | null
  parentCategoryId?: string | null
}

export type CategoryMeta = {
  icon: IconId
  /** Mosaic bento slot art (only categories with real photography). */
  mosaic?: {
    photo: string
    objectPos: string
    tall?: boolean
  }
}

/**
 * Mosaic art comes from `@alkemart/shared/category-art` (single source of
 * truth, also used by the admin studio canvas); only the icon and the tall
 * slot flag stay storefront-local.
 */
function mosaic(handle: string, tall: boolean): CategoryMeta["mosaic"] {
  const art = categoryArtFor(handle)
  return art ? { ...art, tall } : undefined
}

/** Handle → icon/mosaic only. Labels always come from the API name. */
export const CATEGORY_META: Readonly<Record<string, CategoryMeta>> = {
  "phones-electronics": {
    icon: "cat-electronics",
    mosaic: mosaic("phones-electronics", false),
  },
  "food-groceries": {
    icon: "cat-food",
    mosaic: mosaic("food-groceries", true),
  },
  beverages: {
    icon: "cat-beverages",
  },
  "health-beauty": {
    icon: "cat-personal-care",
    mosaic: mosaic("health-beauty", false),
  },
  "pet-care": {
    icon: "cat-pet-care",
    mosaic: mosaic("pet-care", true),
  },
  "baby-kids": {
    icon: "cat-baby",
  },
  "fashion-apparel": {
    icon: "cat-fashion",
  },
  "home-living": {
    icon: "cat-home",
  },
  agriculture: {
    icon: "cat-all",
  },
  automotive: {
    icon: "cat-all",
  },
  services: {
    icon: "cat-all",
  },
  other: {
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

export type RailChild = {
  id: string
  name: string
  handle: string
}

export type RailCategory = {
  id: string
  name: string
  handle?: string | null
  icon: IconId
  /** Direct children for header popdown (empty = link-only chip). */
  children: RailChild[]
}

/**
 * Preferred header order for Ghana marketplace departments.
 * Subcategories appear in each chip’s popdown, not as top-level chips.
 */
/** Exactly six header departments (popdowns carry subcats). */
export const RAIL_DEPARTMENT_ORDER: readonly string[] = [
  "phones-electronics",
  "food-groceries",
  "fashion-apparel",
  "health-beauty",
  "home-living",
  "baby-kids",
] as const

/** Hard cap — do not append extra top-level depts to the rail. */
export const RAIL_MAX = 6

/** Handles kept out of the header rail (still browsable via All / search). */
const RAIL_EXCLUDED = new Set([
  "pet-care",
  "beverages",
  "agriculture",
  "automotive",
  "services",
  "other",
])

function childrenOf(api: NavCategory[], parentId: string): RailChild[] {
  return api
    .filter((c) => c.parentCategoryId === parentId && c.id && c.name)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((c) => ({
      id: c.id,
      name: c.name,
      handle: (c.handle || c.id).toLowerCase(),
    }))
}

function toRailItem(cat: NavCategory, api: NavCategory[]): RailCategory {
  return {
    id: cat.id,
    name: cat.name,
    handle: cat.handle ?? null,
    icon: iconForCategory(cat.name, cat.handle),
    children: childrenOf(api, cat.id),
  }
}

/**
 * Department rail — top-level only, curated order, short list + children for popdowns.
 * Name always from API; icon from CATEGORY_META when known.
 */
export function resolveRailCategories(api: NavCategory[]): RailCategory[] {
  if (!api.length) return []

  // Cloudflare list flattens the tree; rail chips are top-level only.
  const top = api.filter(
    (c) => c.id && c.name && (c.parentCategoryId == null || c.parentCategoryId === ""),
  )
  if (!top.length) return []

  const byHandle = new Map(
    top
      .filter((c) => c.handle)
      .map((c) => [(c.handle || "").toLowerCase(), c] as const),
  )

  const out: RailCategory[] = []
  const used = new Set<string>()

  for (const h of RAIL_DEPARTMENT_ORDER) {
    if (out.length >= RAIL_MAX) break
    const cat = byHandle.get(h)
    if (!cat || used.has(cat.id) || RAIL_EXCLUDED.has(h)) continue
    used.add(cat.id)
    out.push(toRailItem(cat, api))
  }

  // Do not append leftover top-level depts — keep the header at RAIL_MAX.
  return out.slice(0, RAIL_MAX)
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
      title: cat.name,
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
