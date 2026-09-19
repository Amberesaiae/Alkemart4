import { categoryArtFor } from "@alkemart/shared/category-art"

export type NavCategory = {
  id: string
  name: string
  handle?: string | null
  rank?: number | null
  parentCategoryId?: string | null
}

export type RailChild = {
  id: string
  name: string
  handle: string
}

export type RailIconId =
  | "electronics"
  | "fashion"
  | "home"
  | "health"
  | "baby"
  | "food"
  | "beverages"
  | "pet"
  | "all"

export type RailCategory = {
  id: string
  name: string
  handle?: string | null
  icon: RailIconId
  children: RailChild[]
}

/**
 * Preferred header order for Ghana marketplace departments.
 * Spec 03: phones-electronics → fashion → home → health → baby → food last.
 * Slugs copied from the production taxonomy — do not invent new handles.
 */
export const RAIL_DEPARTMENT_ORDER: readonly string[] = [
  "phones-electronics",
  "fashion-apparel",
  "home-living",
  "health-beauty",
  "baby-kids",
  "food-groceries",
] as const

/** Alias used by mosaic / merchandising. Same six, food last. */
export const MARKET_DEPARTMENT_ORDER = RAIL_DEPARTMENT_ORDER

/** Hard cap — do not append extra top-level depts to the rail. */
export const RAIL_MAX = 6

const RAIL_EXCLUDED = new Set([
  "pet-care",
  "beverages",
  "agriculture",
  "automotive",
  "services",
  "other",
])

const ICON_BY_HANDLE: Record<string, RailIconId> = {
  "phones-electronics": "electronics",
  "fashion-apparel": "fashion",
  "home-living": "home",
  "health-beauty": "health",
  "baby-kids": "baby",
  "food-groceries": "food",
  beverages: "beverages",
  "pet-care": "pet",
}

export function capRailDepartments<T>(items: readonly T[]): T[] {
  return items.slice(0, RAIL_MAX)
}

export function iconForCategory(name: string, handle?: string | null): RailIconId {
  const h = (handle ?? "").toLowerCase()
  if (h && ICON_BY_HANDLE[h]) return ICON_BY_HANDLE[h]
  const key = `${name} ${h}`
  if (/phone|electron|tech/i.test(key)) return "electronics"
  if (/fashion|apparel|cloth/i.test(key)) return "fashion"
  if (/home|living|furni/i.test(key)) return "home"
  if (/health|beauty|personal/i.test(key)) return "health"
  if (/baby|kid|child/i.test(key)) return "baby"
  if (/food|groc/i.test(key)) return "food"
  if (/bever|drink/i.test(key)) return "beverages"
  if (/pet|animal/i.test(key)) return "pet"
  return "all"
}

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
 * Department rail — top-level only, curated order, capped at RAIL_MAX.
 * Name always from API; icon from handle map when known.
 */
export function resolveRailCategories(api: NavCategory[]): RailCategory[] {
  if (!api.length) return []

  const top = api.filter(
    (c) => c.id && c.name && (c.parentCategoryId == null || c.parentCategoryId === ""),
  )
  if (!top.length) return []

  const byHandle = new Map(
    top.filter((c) => c.handle).map((c) => [(c.handle || "").toLowerCase(), c] as const),
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

  return capRailDepartments(out)
}

export type MosaicTile = {
  id: string
  slug: string
  title: string
  photo?: string
  objectPos?: string
  tall: boolean
  accent: DeptAccentId
}

export type DeptAccentId =
  | "electronics"
  | "food"
  | "home-pet"
  | "beverages"
  | "health"
  | "baby"
  | "fashion"

export function deptAccentId(name: string, handle?: string | null): DeptAccentId {
  const key = `${name} ${handle ?? ""}`
  if (/phone|electron|tech/i.test(key)) return "electronics"
  if (/food|groc|agricult/i.test(key)) return "food"
  if (/pet|animal|home|living|furni/i.test(key)) return "home-pet"
  if (/bever|drink/i.test(key)) return "beverages"
  if (/health|beauty|personal/i.test(key)) return "health"
  if (/baby|kid|child/i.test(key)) return "baby"
  if (/fashion|apparel/i.test(key)) return "fashion"
  return "electronics"
}

/** Tailwind class for department-accent panels (PLP categories). */
export function deptAccentClass(name: string, handle?: string | null): string {
  const id = deptAccentId(name, handle)
  switch (id) {
    case "electronics":
      return "bg-dept-electronics text-foreground"
    case "food":
      return "bg-dept-food text-foreground"
    case "home-pet":
      return "bg-dept-home-pet text-white"
    case "beverages":
      return "bg-dept-beverages text-white"
    case "health":
      return "bg-dept-health text-white"
    case "baby":
      return "bg-dept-baby text-foreground"
    case "fashion":
      return "bg-dept-home-pet text-white"
  }
}

const MOSAIC_ORDER: readonly string[] = [
  "pet-care",
  "food-groceries",
  "health-beauty",
  "phones-electronics",
]

/**
 * Home mosaic — real categories in a fixed bento. Art from shared photography
 * when present; otherwise colour field + label (never unrelated stock photos).
 */
export function resolveMosaicTiles(
  api: NavCategory[],
  order: readonly string[] = MOSAIC_ORDER,
): MosaicTile[] {
  if (!api.length) return []
  const byHandle = new Map(
    api.filter((c) => c.handle).map((c) => [(c.handle || "").toLowerCase(), c] as const),
  )
  const tiles: MosaicTile[] = []
  const used = new Set<string>()
  for (const [index, h] of order.entries()) {
    const cat = byHandle.get(h)
    if (!cat || used.has(cat.id)) continue
    used.add(cat.id)
    const art = categoryArtFor(h)
    tiles.push({
      id: cat.id,
      slug: cat.handle || cat.id,
      title: cat.name,
      photo: art?.photo,
      objectPos: art?.objectPos,
      tall: index < 2,
      accent: deptAccentId(cat.name, cat.handle),
    })
  }
  return tiles
}

export function resolveBrowseCategory(api: NavCategory[], slug: string): NavCategory | null {
  const s = slug.trim().toLowerCase()
  if (!s || s === "all") return null
  return (
    api.find((c) => (c.handle || "").toLowerCase() === s) ||
    api.find((c) => c.name.toLowerCase() === s) ||
    null
  )
}
