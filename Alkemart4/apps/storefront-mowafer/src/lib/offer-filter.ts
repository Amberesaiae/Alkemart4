import type { StoreProductCard } from "@/lib/products"
import type { RailIconId } from "@/lib/catalog-nav"

export type OfferTabId =
  | "all"
  | "electronics"
  | "food"
  | "beverages"
  | "personal"
  | "pet"
  | "baby"
  | "fashion"
  | "home"

export type OfferTab = {
  id: OfferTabId
  label: string
  handle: string
  icon: RailIconId
}

export type OfferSort = "featured" | "price_asc" | "price_desc" | "newest"
export type OfferView = "grid" | "list"

export const OFFER_TABS: OfferTab[] = [
  { id: "electronics", handle: "phones-electronics", label: "Electronics", icon: "electronics" },
  { id: "fashion", handle: "fashion-apparel", label: "Fashion", icon: "fashion" },
  { id: "home", handle: "home-living", label: "Home", icon: "home" },
  { id: "personal", handle: "health-beauty", label: "Care", icon: "health" },
  { id: "baby", handle: "baby-kids", label: "Baby", icon: "baby" },
  { id: "food", handle: "food-groceries", label: "Food", icon: "food" },
]

const TAB_BY_HANDLE: Record<string, OfferTabId> = {
  "phones-electronics": "electronics",
  "food-groceries": "food",
  beverages: "beverages",
  "health-beauty": "personal",
  "pet-care": "pet",
  "baby-kids": "baby",
  "fashion-apparel": "fashion",
  "home-living": "home",
}

export function tabSlug(tab: OfferTabId | "all"): string {
  const hit = OFFER_TABS.find((t) => t.id === tab)
  return hit?.handle ?? "all"
}

export function availableOfferTabs(
  categories: { handle?: string | null }[],
  tabs: OfferTab[] = OFFER_TABS,
): OfferTab[] {
  if (!categories.length) return tabs
  const handles = new Set(
    categories.map((c) => (c.handle || "").toLowerCase()).filter(Boolean),
  )
  return tabs.filter((t) => handles.has(t.handle.toLowerCase()))
}

export function filterOffersByTab(products: StoreProductCard[], tab: OfferTabId | "all"): StoreProductCard[] {
  if (tab === "all") return products
  return products.filter((p) => {
    for (const handle of p.categoryHandles ?? []) {
      if (TAB_BY_HANDLE[handle.toLowerCase()] === tab) return true
    }
    return false
  })
}

export function sortOffers(products: StoreProductCard[], sort: OfferSort): StoreProductCard[] {
  const list = [...products]
  switch (sort) {
    case "price_asc":
      return list.sort(
        (a, b) => (a.amount ?? Number.POSITIVE_INFINITY) - (b.amount ?? Number.POSITIVE_INFINITY),
      )
    case "price_desc":
      return list.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1))
    case "newest":
      return list.sort((a, b) => {
        const at = a.createdAt ? Date.parse(a.createdAt) : Number.NaN
        const bt = b.createdAt ? Date.parse(b.createdAt) : Number.NaN
        if (Number.isFinite(at) && Number.isFinite(bt)) return bt - at
        return 0
      })
    default:
      return list
  }
}
