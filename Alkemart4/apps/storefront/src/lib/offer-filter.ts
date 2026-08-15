import type { StoreProductCard } from "@/lib/products"
import {
  OFFER_TABS,
  type OfferSort,
  type OfferTab,
  type OfferTabId,
} from "@/components/home/LastOffersTabs"

/** Category handle an offer tab links to ("View more"). */
export function tabSlug(tab: OfferTabId | "all"): string {
  switch (tab) {
    case "electronics":
      return "phones-electronics"
    case "food":
      return "food-groceries"
    case "beverages":
      return "beverages"
    case "personal":
      return "health-beauty"
    case "pet":
      return "pet-care"
    case "baby":
      return "baby-kids"
    default:
      return "all"
  }
}

/** Keep only tabs whose target category exists in the marketplace. */
export function availableOfferTabs(
  categories: { handle?: string | null }[],
  tabs: OfferTab[] = OFFER_TABS,
): OfferTab[] {
  if (!categories.length) return tabs
  const handles = new Set(
    categories
      .map((c) => (c.handle || "").toLowerCase())
      .filter(Boolean),
  )
  return tabs.filter((t) => handles.has(t.handle.toLowerCase()))
}

/**
 * Exact category-handle → offer tab bucket. Handle is the canonical
 * taxonomy key (phones-electronics etc.), so no fuzzy matching needed.
 */
const TAB_BY_CATEGORY_HANDLE: Record<string, OfferTabId> = {
  "phones-electronics": "electronics",
  "food-groceries": "food",
  beverages: "beverages",
  "health-beauty": "personal",
  "pet-care": "pet",
  "baby-kids": "baby",
}

/** Map product → offer tab bucket for client filter (API fields only). */
export function productOfferTab(
  p: StoreProductCard,
): OfferTabId | "all" {
  // Real taxonomy first — never heuristic a real category link.
  for (const handle of p.categoryHandles ?? []) {
    const tab = TAB_BY_CATEGORY_HANDLE[handle.toLowerCase()]
    if (tab) return tab
  }
  const fromLabel = tabFromCategoryLabel(p.categoryLabel)
  if (fromLabel) return fromLabel

  const k =
    `${p.title} ${p.handle ?? ""} ${p.categoryLabel ?? ""}`.toLowerCase()
  if (
    /electron|phone|tech|laptop|tv|camera|headphone|game|fan|tablet|gadget|usb/.test(
      k,
    )
  ) {
    return "electronics"
  }
  if (/food|groc|oil|rice|spice|cook|palm/.test(k)) return "food"
  if (/bever|drink|water|juice|soda/.test(k)) return "beverages"
  if (/health|beauty|care|pharma|medic|cosmetic|aid|hygiene|personal/.test(k))
    return "personal"
  if (/pet|animal|dog|cat/.test(k)) return "pet"
  if (/baby|kid|child|infant|onesie/.test(k)) return "baby"
  return "all"
}

/** Map a canonical category label/handle to a home-strip tab, or null. */
function tabFromCategoryLabel(
  label: string | null | undefined,
): OfferTabId | "all" | null {
  const k = (label ?? "").toLowerCase().replace(/[^a-z]+/g, "-")
  if (!k) return null
  if (/phones|electronics|gadget/.test(k)) return "electronics"
  if (/food|groc|agricultur/.test(k)) return "food"
  if (/bever|drink/.test(k)) return "beverages"
  if (/health|beauty|personal|care/.test(k)) return "personal"
  if (/pet/.test(k)) return "pet"
  if (/baby|kid|infant/.test(k)) return "baby"
  return "all"
}

export function filterOffersByTab(
  products: StoreProductCard[],
  tab: OfferTabId | "all",
): StoreProductCard[] {
  if (tab === "all") return products
  return products.filter((p) => productOfferTab(p) === tab)
}

export function sortOffers(
  products: StoreProductCard[],
  sort: OfferSort,
): StoreProductCard[] {
  const list = [...products]
  switch (sort) {
    case "price_asc":
      return list.sort(
        (a, b) =>
          (a.amount ?? Number.POSITIVE_INFINITY) -
          (b.amount ?? Number.POSITIVE_INFINITY),
      )
    case "price_desc":
      return list.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1))
    case "newest":
      return list.sort((a, b) => {
        const at = a.createdAt ? Date.parse(a.createdAt) : Number.NaN
        const bt = b.createdAt ? Date.parse(b.createdAt) : Number.NaN
        if (Number.isFinite(at) && Number.isFinite(bt)) return bt - at
        if (Number.isFinite(at)) return -1
        if (Number.isFinite(bt)) return 1
        return 0
      })
    case "featured":
    default:
      return list
  }
}
