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
