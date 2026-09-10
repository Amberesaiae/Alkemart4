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
}

export const EMPTY_FACETS: ListingFacetState = {
  sellerHandles: [],
  sort: "featured",
  priceMin: null,
  priceMax: null,
  minRating: 0,
  subCategory: "all",
  location: { province: null, city: null },
}

/** Facets that survive a department change (none — a new dept resets them). */
export function resetFacets(): ListingFacetState {
  return { ...EMPTY_FACETS, location: { province: null, city: null } }
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
