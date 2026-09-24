/**
 * Single source of truth for PLP facets.
 *
 * Before this, the sidebar (`ListingFilterState`) and the strip
 * (`FilterStripState`) each held their own copy of sort/price, and
 * subcategory lived in the sidebar as a route change *and* in the strip as
 * local state — two writers, guaranteed desync. Everything now flows through
 * one `ListingFacetState` that the route serialises into the URL, so a
 * filtered listing is shareable and survives back/forward.
 *
 * Department stays a route (`/categories/$slug`); subcategory is a facet.
 */
import type { LocationFilterValue } from "@/components/listing/ListingLocationFilter"

export type ListingSort = "featured" | "price_asc" | "price_desc" | "title"

export type ListingFacetState = {
  sellerHandles: string[]
  sort: ListingSort
  priceMin: number | null
  priceMax: number | null
  minRating: number
  /** Child category id, or "all" when the department itself is selected. */
  subCategory: string
  location: LocationFilterValue
  /**
   * Definition-backed attribute selections: code -> chosen values.
   * Empty until an admin publishes attribute definitions, so a catalogue
   * without them behaves exactly as before.
   */
  attributes: Record<string, string[]>
}

export const EMPTY_FACETS: ListingFacetState = {
  sellerHandles: [],
  sort: "featured",
  priceMin: null,
  priceMax: null,
  minRating: 0,
  subCategory: "all",
  location: { province: null, city: null },
  attributes: {},
}

/** Facets that survive a department change (none — a new dept resets them). */
export function resetFacets(): ListingFacetState {
  return { ...EMPTY_FACETS, location: { province: null, city: null }, attributes: {} }
}

/** `code:v1,v2` per entry — the same shape /store/search accepts. */
export function serializeAttributeFacets(attributes: Record<string, string[]>): string | undefined {
  const parts = Object.entries(attributes)
    .filter(([, values]) => values.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, values]) => `${code}:${[...values].sort().join(",")}`)
  return parts.length ? parts.join(";") : undefined
}

export function parseAttributeFacets(raw: unknown): Record<string, string[]> {
  if (typeof raw !== "string" || !raw.trim()) return {}
  const out: Record<string, string[]> = {}
  for (const entry of raw.split(";")) {
    const sep = entry.indexOf(":")
    if (sep <= 0) continue
    const code = entry.slice(0, sep).trim()
    const values = entry.slice(sep + 1).split(",").map((v) => v.trim()).filter(Boolean)
    if (code && values.length) out[code] = values
  }
  return out
}

/** Toggle one value of one attribute, dropping the code when it empties. */
export function toggleAttributeFacet(
  state: ListingFacetState,
  code: string,
  value: string,
): ListingFacetState {
  const current = state.attributes[code] ?? []
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value]
  const attributes = { ...state.attributes }
  if (next.length) attributes[code] = next
  else delete attributes[code]
  return { ...state, attributes }
}

export type AppliedFacet = {
  /** Stable key for React and for removal dispatch. */
  key: string
  /** Facet group, shown as the chip's quiet prefix. */
  group: string
  label: string
  /** State with just this facet cleared. */
  clear: (state: ListingFacetState) => ListingFacetState
}

function money(n: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * The applied facets, in the order a shopper reasons about them.
 * Drives both the removable chip row and the active-filter count, so the
 * badge can never disagree with what the chips show.
 */
export function appliedFacets(
  state: ListingFacetState,
  lookup: {
    sellerName?: (handle: string) => string
    subCategoryLabel?: (id: string) => string
    attributeLabel?: (code: string) => string
  } = {},
): AppliedFacet[] {
  const out: AppliedFacet[] = []

  if (state.subCategory !== "all") {
    out.push({
      key: `sub:${state.subCategory}`,
      group: "Category",
      label: lookup.subCategoryLabel?.(state.subCategory) ?? state.subCategory,
      clear: (s) => ({ ...s, subCategory: "all" }),
    })
  }

  for (const handle of state.sellerHandles) {
    out.push({
      key: `seller:${handle}`,
      group: "Seller",
      label: lookup.sellerName?.(handle) ?? handle,
      clear: (s) => ({
        ...s,
        sellerHandles: s.sellerHandles.filter((h) => h !== handle),
      }),
    })
  }

  if (state.minRating > 0) {
    out.push({
      key: "rating",
      group: "Rating",
      label: `${state.minRating}★ & up`,
      clear: (s) => ({ ...s, minRating: 0 }),
    })
  }

  if (state.priceMin != null || state.priceMax != null) {
    const min = state.priceMin
    const max = state.priceMax
    const label =
      min != null && max != null
        ? `${money(min)} – ${money(max)}`
        : min != null
          ? `From ${money(min)}`
          : `Up to ${money(max as number)}`
    out.push({
      key: "price",
      group: "Price",
      label,
      clear: (s) => ({ ...s, priceMin: null, priceMax: null }),
    })
  }

  for (const [code, values] of Object.entries(state.attributes)) {
    for (const value of values) {
      out.push({
        key: `attr:${code}:${value}`,
        group: lookup.attributeLabel?.(code) ?? code,
        label: value,
        clear: (s2) => toggleAttributeFacet(s2, code, value),
      })
    }
  }

  const { province, city } = state.location
  if (province || city) {
    out.push({
      key: "location",
      group: "Location",
      label: [city, province].filter(Boolean).join(", "),
      clear: (s) => ({ ...s, location: { province: null, city: null } }),
    })
  }

  if (state.sort !== "featured") {
    const labels: Record<ListingSort, string> = {
      featured: "Featured",
      price_asc: "Price: low to high",
      price_desc: "Price: high to low",
      title: "Name A–Z",
    }
    out.push({
      key: "sort",
      group: "Sort",
      label: labels[state.sort],
      clear: (s) => ({ ...s, sort: "featured" }),
    })
  }

  return out
}

export function activeFacetCount(state: ListingFacetState): number {
  return appliedFacets(state).length
}

/* ─── Client-side application of the facets ───
 * Kept next to the state they consume rather than inside the sidebar
 * component, so the route can apply them without importing UI.
 */

export function sortListingProducts<
  T extends { title: string; amount?: number | null },
>(items: T[], sort: ListingSort): T[] {
  const copy = [...items]
  if (sort === "price_asc") {
    return copy.sort(
      (a, b) =>
        (a.amount ?? Number.POSITIVE_INFINITY) -
        (b.amount ?? Number.POSITIVE_INFINITY),
    )
  }
  if (sort === "price_desc") {
    return copy.sort(
      (a, b) =>
        (b.amount ?? Number.NEGATIVE_INFINITY) -
        (a.amount ?? Number.NEGATIVE_INFINITY),
    )
  }
  if (sort === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title))
  }
  return copy
}

export function filterListingBySellers<
  T extends { seller?: { handle?: string | null } | null },
>(items: T[], sellerHandles: string[]): T[] {
  if (!sellerHandles.length) return items
  const set = new Set(sellerHandles)
  return items.filter((p) => {
    const h = p.seller?.handle?.trim()
    return h ? set.has(h) : false
  })
}

export function filterListingByPrice<T extends { amount?: number | null }>(
  items: T[],
  min?: number | null,
  max?: number | null,
): T[] {
  if (min == null && max == null) return items
  return items.filter((p) => {
    if (p.amount == null || !Number.isFinite(p.amount)) return false
    if (min != null && p.amount < min) return false
    if (max != null && p.amount > max) return false
    return true
  })
}

export function filterListingByRating<T extends { rating?: number | null }>(
  items: T[],
  minRating: number,
): T[] {
  if (!minRating || minRating <= 0) return items
  return items.filter((p) => (p.rating ?? 5) >= minRating)
}

/**
 * Facets that survive any navigation, because they mean the same thing
 * everywhere: price, rating, sellers, location, sort, availability.
 *
 * Attribute facets are the opposite — `ram_gb` is meaningless in Accessories —
 * so they are validated against the destination category and dropped when they
 * do not apply. See `retargetFacets`.
 */
export type RetargetResult = {
  state: ListingFacetState
  /** Attribute codes removed because the destination does not declare them. */
  dropped: { code: string; values: string[] }[]
}

/**
 * The one transition every surface uses when navigation changes.
 *
 * The tile rail used to spread `...search` (carrying `ram_gb` into a category
 * with no RAM) while both sidebar links carried nothing (silently discarding
 * the buyer's price range). Same click, three different outcomes depending on
 * where you clicked it. This is the single place that decides.
 *
 * `allowedCodes` is the destination's facet list. Pass `null` when it has not
 * loaded yet — nothing is dropped until we actually know, because guessing
 * would remove a filter the category might well support.
 */
export function retargetFacets(
  state: ListingFacetState,
  allowedCodes: readonly string[] | null,
  options: { clearSubCategory?: boolean } = {},
): RetargetResult {
  const next: ListingFacetState = {
    ...state,
    ...(options.clearSubCategory ? { subCategory: "all" } : {}),
    attributes: {},
  }
  if (allowedCodes === null) {
    return { state: { ...next, attributes: state.attributes }, dropped: [] }
  }
  const allowed = new Set(allowedCodes.map((c) => c.toLowerCase()))
  const dropped: { code: string; values: string[] }[] = []
  for (const [code, values] of Object.entries(state.attributes)) {
    if (values.length === 0) continue
    if (allowed.has(code.toLowerCase())) next.attributes[code] = values
    else dropped.push({ code, values })
  }
  return { state: next, dropped }
}
