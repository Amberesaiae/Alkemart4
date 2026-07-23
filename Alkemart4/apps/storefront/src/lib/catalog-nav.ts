/**
 * Production catalog navigation — API data only.
 * No demo seed, no invented categories or products.
 */

export type NavCategory = {
  id: string
  name: string
  handle?: string | null
}

/** Preferred department order for rail (labels from real API when present). */
const RAIL_ORDER: ReadonlyArray<{ handle: string; label: string; match: RegExp }> =
  [
    {
      handle: "phones-electronics",
      label: "Electronics",
      match: /electron|phone|tech|gadget|comput|device/,
    },
    {
      handle: "food-groceries",
      label: "Food",
      match: /food|groc|agricult|kitchen|cook|spice|oil|rice/,
    },
    {
      handle: "beverages",
      label: "Beverages",
      match: /bever|drink|water|juice|soda/,
    },
    {
      handle: "health-beauty",
      label: "Personal Care",
      match: /beauty|personal|cosmetic|skin|makeup|hygiene|health/,
    },
    {
      handle: "pet-care",
      label: "Pet Care",
      match: /pet|animal|\bdog\b|\bcats?\b/,
    },
    {
      handle: "baby-kids",
      label: "Baby Care",
      match: /baby|kid|child|infant|toddler/,
    },
  ]

const MOSAIC_ORDER = [
  "pet-care",
  "food-groceries",
  "health-beauty",
  "phones-electronics",
] as const

/**
 * Department rail: real API categories only, ordered by marketplace priority.
 * Empty if API returns no categories — never invents demo rows.
 */
export function resolveRailCategories(api: NavCategory[]): NavCategory[] {
  if (!api.length) return []

  const used = new Set<string>()
  const out: NavCategory[] = []

  for (const slot of RAIL_ORDER) {
    const hit =
      api.find(
        (c) =>
          (c.handle || "").toLowerCase() === slot.handle && !used.has(c.id),
      ) ||
      api.find(
        (c) =>
          !used.has(c.id) &&
          slot.match.test(`${c.name} ${c.handle ?? ""}`.toLowerCase()),
      )
    if (hit) {
      used.add(hit.id)
      out.push({
        id: hit.id,
        name: slot.label,
        handle: hit.handle || slot.handle,
      })
    }
  }

  // Append remaining real categories (not already on rail)
  for (const c of api) {
    if (used.has(c.id)) continue
    out.push(c)
  }

  return out
}

/**
 * Home mosaic tiles from real categories only (up to 4 preferred handles).
 * Falls back to first API categories if preferred handles missing.
 */
export function resolveMosaicCategories(api: NavCategory[]): NavCategory[] {
  if (!api.length) return []

  const byHandle = new Map(
    api
      .filter((c) => c.handle)
      .map((c) => [(c.handle || "").toLowerCase(), c] as const),
  )
  const picked: NavCategory[] = []
  const used = new Set<string>()

  for (const h of MOSAIC_ORDER) {
    const hit = byHandle.get(h)
    if (hit && !used.has(hit.id)) {
      used.add(hit.id)
      picked.push(hit)
    }
  }

  if (picked.length >= 4) return picked.slice(0, 4)

  for (const c of api) {
    if (used.has(c.id)) continue
    used.add(c.id)
    picked.push(c)
    if (picked.length >= 4) break
  }

  return picked
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
