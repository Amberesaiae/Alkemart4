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
}

export type ProductDetailInput = {
  productId: string
  title: string
  description: string | null
  categoryHandle: string
  categoryName: string
  imageUrls: string[]
}

export function toProductCard(
  product: ProductCardInput,
  sellableOffers: Array<{ offerId: string; pricePesewas: bigint }>,
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
