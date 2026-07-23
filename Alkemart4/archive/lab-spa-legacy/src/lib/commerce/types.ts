/**
 * SPA commerce domain types (Medusa adapters map into these).
 * UI continues to use Alkemart field names (pricePesewas, titleSnapshot, etc.).
 */

export type ProductId = string & { readonly __brand: "ProductId" }
export type VariantId = string & { readonly __brand: "VariantId" }

export type CommerceVendor = {
  slug: string
  name: string
  ratingAvgX100: number
  ratingCount: number
}

export type CommerceProduct = {
  id: ProductId
  /** First purchasable variant; empty string if product has no variants. */
  variantId: VariantId
  /**
   * Mercur marketplace offer for the default variant (required for cart line items).
   * Vanilla Medusa carts use variant_id; Mercur store carts require offer_id.
   */
  offerId?: string | null
  title: string
  handle?: string
  description?: string
  brand?: string
  tag?: "rollback" | "clearance" | "best" | "popular" | "new" | null
  /** Amount in pesewas when known; 0 when price unavailable (see isPriceAvailable). */
  pricePesewas: number
  /** False when Medusa did not return a calculated/list price. */
  isPriceAvailable?: boolean
  compareAtPesewas?: number
  ratingAvgX100: number
  ratingCount: number
  imageUrl: string
  /**
   * Sellable quantity when known.
   * - number: explicit inventory (0 = out of stock)
   * - null: inventory unknown (do not invent 10)
   */
  stock: number | null
  sku?: string
  categoryHandle?: string
  /** Real seller link only — never invent a default-vendor. */
  vendor: CommerceVendor | null
}

export type CommerceCart = {
  id: string
  items: Array<{
    id: string
    qty: number
    variantId: VariantId
    product: {
      title: string
      pricePesewas: number
      compareAtPesewas?: number
      imageUrl: string
      productId: ProductId
      /** Seller display name when Medusa/Mercur metadata provides it. */
      vendorName?: string | null
    }
  }>
  subtotalPesewas: number
}

export type CommerceOrder = {
  id: string
  status: string
  totalPesewas: number
  currencyCode: string
  createdAt: string
  items: Array<{
    id: string
    titleSnapshot: string
    qty: number
    unitPesewas: number
    thumbnail?: string
  }>
}
