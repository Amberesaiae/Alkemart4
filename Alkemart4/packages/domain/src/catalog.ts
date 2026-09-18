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

export type ProductOptionTypeDto = {
  name: string
  values: { value: string; imageUrl: string | null }[]
}

/** Every combination incl. unstocked/archived (for honest strikethrough). */
export type ProductComboDetailDto = {
  offerId: string
  sellerId: string
  options: Record<string, string>
  pricePesewas: string
  availableQty: number
  active: boolean
}

export type ProductReviewDto = {
  rating: number
  title: string | null
  body: string
  vendorResponse: string | null
  createdAt: string
}

export type ProductDetailDto = {
  productId: string
  title: string
  description: string | null
  categoryHandle: string
  categoryName: string
  imageUrls: string[]
  offers: PeerOfferDto[]
  optionTypes: ProductOptionTypeDto[]
  combos: ProductComboDetailDto[]
  ratingAvg: number | null
  ratingCount: number
  reviews: ProductReviewDto[]
  /** Structured facts about the item — what it is, not what you pick. */
  attributes: { label: string; value: string }[]
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
  attributes?: { label: string; value: string }[]
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
  extras?: {
    optionTypes?: ProductOptionTypeDto[]
    combos?: ProductComboDetailDto[]
    reviews?: { rating: number; title: string | null; body: string; vendorResponse: string | null; createdAt: Date }[]
  },
): ProductDetailDto {
  const published = extras?.reviews ?? []
  const ratingCount = published.length
  return {
    productId: product.productId,
    title: product.title,
    description: product.description,
    categoryHandle: product.categoryHandle,
    categoryName: product.categoryName,
    imageUrls: product.imageUrls,
    attributes: product.attributes ?? [],
    offers: sortPeerOffers(sellableOffers).map(toPeerOffer),
    optionTypes: extras?.optionTypes ?? [],
    combos: extras?.combos ?? [],
    ratingAvg: ratingCount > 0 ? published.reduce((n, r) => n + r.rating, 0) / ratingCount : null,
    ratingCount,
    reviews: published.slice(0, 5).map((r) => ({
      rating: r.rating,
      title: r.title,
      body: r.body,
      vendorResponse: r.vendorResponse,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  }
}
