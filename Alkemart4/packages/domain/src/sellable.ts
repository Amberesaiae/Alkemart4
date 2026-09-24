export type ProductStatus = "draft" | "proposed" | "published" | "rejected"
export type SellerStatus = "pending_approval" | "open" | "suspended" | "terminated"

export type SellableInput = {
  productStatus: ProductStatus
  sellerStatus: SellerStatus
  offerActive: boolean
  onHand: number
  reserved: number
  pricePesewas: bigint
}

export function isSellable(input: SellableInput): boolean {
  return (
    input.productStatus === "published" &&
    input.sellerStatus === "open" &&
    input.offerActive &&
    input.onHand - input.reserved > 0 &&
    input.pricePesewas > 0n
  )
}

/**
 * Can this offer appear in the catalogue at all?
 *
 * Deliberately weaker than `isSellable`: everything except stock. An
 * out-of-stock product still belongs on the shelf — hiding it loses the
 * search ranking it has earned, loses the buyer who would have waited or
 * asked, and makes a young marketplace look empty when it is merely
 * between deliveries. Jumia and Jiji both list out-of-stock items with a
 * badge rather than deleting them from view.
 *
 * `isSellable` remains the only gate on adding to cart and checking out.
 * Listable is a *display* predicate and must never be used to authorise a
 * purchase.
 */
export function isListable(input: Omit<SellableInput, "onHand" | "reserved">): boolean {
  return (
    input.productStatus === "published" &&
    input.sellerStatus === "open" &&
    input.offerActive &&
    input.pricePesewas > 0n
  )
}
