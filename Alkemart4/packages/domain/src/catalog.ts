import { pickBestOffer, sortPeerOffers, toPeerOffer, type PeerOfferDto, type PeerOfferInput } from "./offers"

export type ProductCardDto = {
  productId: string
  title: string
  categoryHandle: string
  categoryName: string
  imageUrl: string | null
  fromPricePesewas: string
  bestOfferId: string
  offerCount: number
  /** Seller behind the best offer — the shop an add-to-cart binds to. */
  sellerId: string
  sellerHandle: string
  sellerName: string
  /** Sellable units on the best offer (on_hand − reserved). */
  availableQty: number
  /** ISO timestamp of product creation; null when the row predates the column. */
  createdAt: string | null
  currency: "ghs"
}

export type ProductDetailDto = {
  productId: string
  title: string
  description: string | null
  categoryHandle: string
  categoryName: string
  imageUrls: string[]
  offers: PeerOfferDto[]
}

export type ProductCardInput = {
  productId: string
  title: string
  categoryHandle: string
  categoryName: string
  imageUrl: string | null
  createdAt?: string | null
}

export type ProductDetailInput = {
  productId: string
  title: string
  description: string | null
  categoryHandle: string
  categoryName: string
  imageUrls: string[]
}

/** Card-level offer facts; satisfied by PeerOfferInput and by test fixtures. */
export type CardOfferInput = {
  offerId: string
  pricePesewas: bigint
  sellerId: string
  sellerHandle: string
  sellerName: string
  onHand: number
  reserved: number
}

export function toProductCard(
  product: ProductCardInput,
  sellableOffers: CardOfferInput[],
): ProductCardDto {
  const best = pickBestOffer(sellableOffers)
  if (!best) {
    throw new Error("product has no sellable offers")
  }
  return {
    productId: product.productId,
    title: product.title,
    categoryHandle: product.categoryHandle,
    categoryName: product.categoryName,
    imageUrl: product.imageUrl,
    fromPricePesewas: best.pricePesewas.toString(),
    bestOfferId: best.offerId,
    offerCount: sellableOffers.length,
    sellerId: best.sellerId,
    sellerHandle: best.sellerHandle,
    sellerName: best.sellerName,
    availableQty: best.onHand - best.reserved,
    createdAt: product.createdAt ?? null,
    currency: "ghs",
  }
}

export function toProductDetail(
  product: ProductDetailInput,
  sellableOffers: PeerOfferInput[],
): ProductDetailDto {
  return {
    productId: product.productId,
    title: product.title,
    description: product.description,
    categoryHandle: product.categoryHandle,
    categoryName: product.categoryName,
    imageUrls: product.imageUrls,
    offers: sortPeerOffers(sellableOffers).map(toPeerOffer),
  }
}
