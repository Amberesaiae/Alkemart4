/**
 * Category presentation helpers (icons / mosaic art by handle).
 *
 * Display names come from the API (`NavCategory.name`). CATEGORY_META may
 * only supply icon + mosaic art — never a parallel rename table for labels.
 */
import { categoryIconId, type IconId } from "@/design/icons"

export type NavCategory = {
  id: string
  name: string
  handle?: string | null
  rank?: number | null
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

/** Handle → icon/mosaic only. Labels always come from the API name. */
export const CATEGORY_META: Readonly<Record<string, CategoryMeta>> = {
  "phones-electronics": {
    icon: "cat-electronics",
    mosaic: {
      photo: "/images/categories/electronics.webp",
      objectPos: "object-center",
      tall: false,
    },
  },
  "food-groceries": {
    icon: "cat-food",
    mosaic: {
      photo: "/images/categories/food.webp",
      objectPos: "object-center",
      tall: true,
    },
  },
  beverages: {
    icon: "cat-beverages",
  },
  "health-beauty": {
    icon: "cat-personal-care",
    mosaic: {
      photo: "/images/categories/cosmetics.webp",
      objectPos: "object-[center_20%]",
      tall: false,
    },
  },
  "pet-care": {
    icon: "cat-pet-care",
    mosaic: {
      photo: "/images/categories/pets.webp",
      objectPos: "object-[center_15%]",
      tall: true,
    },
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

export type RailCategory = {
  id: string
  name: string
  handle?: string | null
  icon: IconId
}

/**
 * Department rail — every real top-level category, in rank order.
 * Name always from API; icon from CATEGORY_META when known.
 */
export function resolveRailCategories(api: NavCategory[]): RailCategory[] {
  if (!api.length) return []
  const ranked = [...api].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  return ranked
    .filter((c) => c.id && c.name)
    .map((c) => ({
      id: c.id,
      name: c.name,
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
