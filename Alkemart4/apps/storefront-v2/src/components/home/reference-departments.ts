import { departmentFor } from "@/lib/departments"
import type { StoreCategory } from "@/lib/products"

export const REFERENCE_DEPARTMENTS = [
  { id: "electronics", title: "Electronics", short: "Phones", tagline: "Upgrade your world", light: true, ground: "#121216" },
  { id: "fashion", title: "Fashion", short: "Fashion", tagline: "Express your style", light: true, ground: "#7A13FF" },
  { id: "home", title: "Home & Living", short: "Home", tagline: "Make home easier", light: false, ground: "#FFC69A" },
  { id: "beauty", title: "Beauty", short: "Beauty", tagline: "Look and feel good", light: false, ground: "#FF8A90" },
  { id: "gaming", title: "Gaming", short: "Gaming", tagline: "Play without limits", light: true, ground: "#063EFF" },
  { id: "appliances", title: "Appliances", short: "Appliances", tagline: "For a smarter home", light: false, ground: "#9EEACD" },
] as const

type ReferenceId = typeof REFERENCE_DEPARTMENTS[number]["id"]

/** The real category behind a marketing entry point, if the taxonomy has one. */
export function referenceDepartmentCategory(id: ReferenceId, categories: StoreCategory[]): StoreCategory | undefined {
  // Appliances live under Home & Living; point at that category, not a search.
  if (id === "appliances") {
    const appliances = categories.find((c) => c.handle === "home-appliances")
    if (appliances) return appliances
  }
  return categories.find(c => !c.parentCategoryId && departmentFor(c.handle, c.name).id === id)
}

/** Never invent taxonomy handles for a marketing entry point. */
export function referenceDepartmentHref(id: ReferenceId, categories: StoreCategory[]) {
  const category = referenceDepartmentCategory(id, categories)
  return category ? `/categories/${category.handle ?? category.id}` : `/search?q=${encodeURIComponent(id)}`
}

/** Entry points with listings behind them; all of them while stock is unknown. */
export function stockedReferenceDepartments(categories: StoreCategory[], stocked: Set<string> | null) {
  if (!stocked) return [...REFERENCE_DEPARTMENTS]
  return REFERENCE_DEPARTMENTS.filter((d) => {
    const c = referenceDepartmentCategory(d.id, categories)
    return Boolean(c && stocked.has(c.id))
  })
}
