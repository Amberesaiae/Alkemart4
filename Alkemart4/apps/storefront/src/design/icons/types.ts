/**
 * Canonical icon ids for the storefront.
 * Assets live under public/icons/mowafer/ or src/assets/icons/ when supplied.
 * Until then Icon.tsx draws a stable outline placeholder.
 */
export const ICON_IDS = [
  // Category rail (Mowafer)
  "cat-electronics",
  "cat-food",
  "cat-beverages",
  "cat-personal-care",
  "cat-pet-care",
  "cat-baby",
  "cat-fashion",
  "cat-home",
  "cat-health",
  "cat-all",
  // Chrome
  "search",
  "cart",
  "user",
  "heart",
  "bookmark",
  "globe",
  "menu",
  "chevron-right",
  "chevron-left",
  "chevron-down",
  "chevron-up",
  "close",
  // Commerce
  "add-cart",
  "star",
  "star-half",
  "star-empty",
  "filter-grid",
  "filter-list",
  "delivery",
  "package",
  "location",
  "payment",
  "check",
  // Trust / home bands
  "truck",
  "world",
  "secure",
  "cod",
  "wallet",
  "flash",
  // Food Delivery icon pack — lineal
  "delivery-truck",
  "delivery-moto",
  "delivery-bike",
  "delivery-van",
  "delivery-scheduled",
  "delivery-fast",
  "delivery-handoff",
  "delivery-location",
  "delivery-person",
  "order-bag",
  "order-bag-food",
  "order-takeout",
  "order-takeout-box",
  "order-container",
  "order-hot",
  "order-food-bag",
  "order-app",
  "order-phone",
  "receipt",
  "payment-cash",
  "promo-food",
] as const


export type IconId = (typeof ICON_IDS)[number]

/**
 * Map product category → rail/mosaic icon id.
 * Icons: iconpack pixel set under public/icons/mowafer/cat-*.png
 */
export function categoryIconId(
  name: string,
  handle?: string | null,
): IconId {
  const k = `${name} ${handle ?? ""}`.toLowerCase()
  if (/phone|electron|tech|comput|gadget|laptop|device/.test(k))
    return "cat-electronics"
  if (/food|groc|agricult|kitchen|cook|spice|oil|rice/.test(k))
    return "cat-food"
  if (/bever|drink|water|juice|soda/.test(k)) return "cat-beverages"
  if (/beauty|personal|cosmetic|skin|makeup|hygiene/.test(k))
    return "cat-personal-care"
  if (/health|pharma|medic|drug|wellness/.test(k)) return "cat-health"
  if (/pet|animal|\bdog\b|\bcats?\b/.test(k)) return "cat-pet-care"
  if (/baby|kid|child|infant|toddler/.test(k)) return "cat-baby"
  if (/fashion|apparel|cloth|wear|dress|shirt/.test(k)) return "cat-fashion"
  if (/home|living|furni|decor|lamp/.test(k)) return "cat-home"
  return "cat-all"
}
