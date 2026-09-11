export type PeerOfferDto = {
  offerId: string
  sellerId: string
  sellerHandle: string
  sellerName: string
  pricePesewas: string
  currency: "ghs"
  available: number
  deliveryFeePesewas: string
  /** Combination option map (V1 matrix); empty for legacy offers. */
  options: Record<string, string>
}

export type PeerOfferInput = {
  offerId: string
  sellerId: string
  sellerHandle: string
  sellerName: string
  pricePesewas: bigint
  onHand: number
  reserved: number
  deliveryFeePesewas: bigint
  options?: Record<string, string>
}

function compareOfferPriceThenId<T extends { pricePesewas: bigint; offerId: string }>(
  a: T,
  b: T,
): number {
  if (a.pricePesewas !== b.pricePesewas) return a.pricePesewas < b.pricePesewas ? -1 : 1
  return a.offerId.localeCompare(b.offerId)
}

export function pickBestOffer<T extends { pricePesewas: bigint; offerId: string }>(
  offers: T[],
): T | null {
  if (offers.length === 0) return null
  return [...offers].sort(compareOfferPriceThenId)[0] ?? null
}

export function sortPeerOffers<T extends { pricePesewas: bigint; offerId: string }>(
  offers: T[],
): T[] {
  return [...offers].sort(compareOfferPriceThenId)
}

export function toPeerOffer(offer: PeerOfferInput): PeerOfferDto {
  return {
    offerId: offer.offerId,
    sellerId: offer.sellerId,
    sellerHandle: offer.sellerHandle,
    sellerName: offer.sellerName,
    pricePesewas: offer.pricePesewas.toString(),
    currency: "ghs",
    available: offer.onHand - offer.reserved,
    deliveryFeePesewas: offer.deliveryFeePesewas.toString(),
    options: offer.options ?? {},
  }
}
