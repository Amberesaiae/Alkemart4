import type { StoreProductCard } from "@/lib/products"
import type { OfferSort, OfferTabId } from "@/components/home/LastOffersTabs"

/**
 * Map product → offer tab bucket.
 *
 * Preference order:
 *  1. Real canonical category (product.categoryLabel — set from the Medusa
 *     taxonomy by the catalog route). No fuzzy matching on real data.
 *  2. Keyword fallback on title/handle/demoCategory for products that have no
 *     category linked yet (vendor skipped categoryId in Quick Sell).
 */
export function productOfferTab(
  p: StoreProductCard,
): OfferTabId | "all" {
  const fromCategory = tabFromCategoryLabel(p.categoryLabel)
  if (fromCategory) return fromCategory

  const k = `${p.title} ${p.handle ?? ""} ${p.demoCategory ?? ""}`.toLowerCase()
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
  // fashion / home: no dedicated tab in Mowafer home strip — show under All
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
      return list.reverse()
    case "featured":
    default:
      return list
  }
}
