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

/** Never invent taxonomy handles for a marketing entry point. */
export function referenceDepartmentHref(id: typeof REFERENCE_DEPARTMENTS[number]["id"], categories: StoreCategory[]) {
  const category = categories.find(c => departmentFor(c.handle, c.name).id === id)
  return category ? `/categories/${category.handle ?? category.id}` : `/search?q=${encodeURIComponent(id)}`
}
