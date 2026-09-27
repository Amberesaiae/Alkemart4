/**
 * Category navigation helpers. Names and the tree always come from the API;
 * nothing here invents a category.
 */

export type NavCategory = {
  id: string
  name: string
  handle?: string | null
  rank?: number | null
  parentCategoryId?: string | null
}

/** A category by URL slug (handle), falling back to an exact name match. */
export function resolveBrowseCategory(api: NavCategory[], slug: string): NavCategory | null {
  const s = slug.trim().toLowerCase()
  if (!s || s === "all") return null
  return (
    api.find((c) => (c.handle || "").toLowerCase() === s) ||
    api.find((c) => c.name.toLowerCase() === s) ||
    null
  )
}

/** Title for a slug the API could not resolve (shown only while it loads). */
export function formatSlugTitle(s: string): string {
  if (!s) return "Category"
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Sub-categories: the category's real children from the API, rank order.
 * No invented fallbacks — a department without children shows no chips.
 */
export function resolveSubCategories(
  category: { id: string; name?: string | null } | null,
  all: { id: string; name: string; handle?: string | null; parentCategoryId?: string | null; rank?: number | null }[],
): { id: string; label: string; handle: string | null }[] {
  if (!category) return []
  const parentName = (category.name ?? "").trim().toLowerCase()
  return all
    .filter((c) => c.parentCategoryId === category.id)
    // A child named exactly like its parent is taxonomy noise, not a choice.
    .filter((c) => c.name.trim().toLowerCase() !== parentName)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((c) => ({ id: c.id, label: c.name, handle: c.handle ?? null }))
}
