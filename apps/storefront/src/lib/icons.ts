/**
 * Curated mono icons from IconScout pack (cleaned + recolored).
 * Black (default) for light UI; yellow for accents on dark chips.
 */

export type IconKey =
  | "cart"
  | "add-to-cart"
  | "checkout"
  | "account"
  | "address"
  | "order"
  | "delivery-truck"
  | "deliver"
  | "wallet"
  | "money"
  | "seller"
  | "support"
  | "security"
  | "wishlist"
  | "location"
  | "search-market"
  | "return"
  | "sales-analytics"
  | "invoice"
  | "customer"

export type IconAsset = {
  src: string
  srcPng: string
  alt: string
}

const BASE = "/icons"

function icon(file: IconKey, alt: string, yellow = false): IconAsset {
  const name = yellow ? `${file}-yellow` : file
  return {
    src: `${BASE}/${name}.webp`,
    srcPng: `${BASE}/${name}.png`,
    alt,
  }
}

export const ICONS: Record<IconKey, IconAsset> = {
  cart: icon("cart", "Cart"),
  "add-to-cart": icon("add-to-cart", "Add to cart"),
  checkout: icon("checkout", "Checkout"),
  account: icon("account", "Account"),
  address: icon("address", "Address"),
  order: icon("order", "Orders"),
  "delivery-truck": icon("delivery-truck", "Delivery"),
  deliver: icon("deliver", "Deliver"),
  wallet: icon("wallet", "Wallet"),
  money: icon("money", "Payment"),
  seller: icon("seller", "Seller"),
  support: icon("support", "Support"),
  security: icon("security", "Security"),
  wishlist: icon("wishlist", "Wishlist"),
  location: icon("location", "Location"),
  "search-market": icon("search-market", "Market"),
  return: icon("return", "Returns"),
  "sales-analytics": icon("sales-analytics", "Analytics"),
  invoice: icon("invoice", "Invoice"),
  customer: icon("customer", "Customer"),
}

export function iconAsset(key: IconKey, tone: "ink" | "yellow" = "ink"): IconAsset {
  if (tone === "yellow") {
    return icon(key, ICONS[key].alt, true)
  }
  return ICONS[key]
}
