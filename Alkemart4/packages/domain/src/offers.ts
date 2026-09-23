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
  /** Offer terms (Phase 3A); null reads as unknown — never fabricated. */
  condition: string | null
  fulfillmentOrigin: string | null
  warrantyRef: string | null
  returnsRef: string | null
  deliveryPromise: string | null
  compareAtPesewas: string | null
  /** Discount % shown only when compare-at has provenance (else null). */
  discountPercent: number | null
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
  condition?: string | null
  fulfillmentOrigin?: string | null
  warrantyRef?: string | null
  returnsRef?: string | null
  deliveryPromise?: string | null
  compareAtPesewas?: bigint | null
  compareAtProvenance?: string | null
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
    condition: offer.condition ?? null,
    fulfillmentOrigin: offer.fulfillmentOrigin ?? null,
    warrantyRef: offer.warrantyRef ?? null,
    returnsRef: offer.returnsRef ?? null,
    deliveryPromise: offer.deliveryPromise ?? null,
    compareAtPesewas: offer.compareAtPesewas?.toString() ?? null,
    discountPercent: discountPercent(offer.pricePesewas, offer.compareAtPesewas, offer.compareAtProvenance),
  }
}

export class PriceIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PriceIntegrityError"
  }
}

/**
 * Compare-at requires provenance. A reference price without a source is
 * rejected — percentage-off labels must reference something real.
 */
export function assertCompareAt(
  pricePesewas: bigint,
  compareAtPesewas: bigint | null | undefined,
  provenance: string | null | undefined,
): void {
  if (compareAtPesewas == null) return
  if (compareAtPesewas <= pricePesewas) {
    throw new PriceIntegrityError("compare-at price must exceed the selling price")
  }
  if (!provenance || !provenance.trim()) {
    throw new PriceIntegrityError("compare-at price requires provenance")
  }
}

/** Discount % for display; null unless compare-at has provenance. */
export function discountPercent(
  pricePesewas: bigint,
  compareAtPesewas: bigint | null | undefined,
  provenance: string | null | undefined,
): number | null {
  if (compareAtPesewas == null || compareAtPesewas <= 0n) return null
  if (!provenance || !provenance.trim()) return null
  if (compareAtPesewas <= pricePesewas) return null
  return Math.round(Number(((compareAtPesewas - pricePesewas) * 100n) / compareAtPesewas))
}

/**
 * Excessive price divergence across peer offers triggers human review
 * rather than automatic accusation. Returns true when max/min exceeds 3×.
 */
export function priceDivergenceNeedsReview(pricesPesewas: bigint[]): boolean {
  if (pricesPesewas.length < 2) return false
  const positive = pricesPesewas.filter((p) => p > 0n)
  if (positive.length < 2) return false
  const min = positive.reduce((a, b) => (a < b ? a : b))
  const max = positive.reduce((a, b) => (a > b ? a : b))
  return max > min * 3n
}

/** Stale offers suppress after 72h without a freshness signal. */
export function isOfferStale(freshnessAt: Date | null, now: Date = new Date()): boolean {
  if (!freshnessAt) return false
  return now.getTime() - freshnessAt.getTime() > 72 * 3_600_000
}

export type PeerRankSort = "price" | "delivery" | "trust"

export type RankableOffer = {
  offerId: string
  pricePesewas: bigint
  deliveryFeePesewas: bigint
  sellerRatingAvg: number | null
  sellerRatingCount: number
  sellerCompletedOrders: number
}

/**
 * Best-offer ordering. Default is total payable cost; buyers can re-sort by
 * price, delivery, or trust. Paid placement never enters this ranking —
 * sponsored inventory is labeled separately (Phase 5).
 */
export function rankPeerOffers<T extends RankableOffer>(offers: T[], sort?: PeerRankSort): T[] {
  const total = (o: RankableOffer) => o.pricePesewas + o.deliveryFeePesewas
  const trustScore = (o: RankableOffer) =>
    (o.sellerRatingAvg ?? 0) * 100 + Math.min(o.sellerCompletedOrders, 1000) / 100
  const sorted = [...offers]
  switch (sort) {
    case "price":
      sorted.sort((a, b) =>
        a.pricePesewas !== b.pricePesewas
          ? a.pricePesewas < b.pricePesewas
            ? -1
            : 1
          : a.offerId.localeCompare(b.offerId),
      )
      break
    case "delivery":
      sorted.sort((a, b) =>
        a.deliveryFeePesewas !== b.deliveryFeePesewas
          ? a.deliveryFeePesewas < b.deliveryFeePesewas
            ? -1
            : 1
          : total(a) < total(b)
            ? -1
            : 1,
      )
      break
    case "trust":
      sorted.sort((a, b) => trustScore(b) - trustScore(a) || (total(a) < total(b) ? -1 : 1))
      break
    default:
      sorted.sort((a, b) => (total(a) !== total(b) ? (total(a) < total(b) ? -1 : 1) : a.offerId.localeCompare(b.offerId)))
      break
  }
  return sorted
}

/** Buyer-visible explanation for the current ordering. Never claims "best" without it. */
export function explainRanking(sort: PeerRankSort | undefined): string {
  switch (sort) {
    case "price":
      return "Sorted by item price, lowest first. Delivery fees are shown per offer."
    case "delivery":
      return "Sorted by delivery fee, lowest first. Item prices are shown per offer."
    case "trust":
      return "Sorted by seller track record (verified ratings and completed orders)."
    default:
      return "Sorted by total payable cost: item price plus delivery fee."
  }
}
