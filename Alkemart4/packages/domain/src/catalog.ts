import { pickBestOffer, sortPeerOffers, toPeerOffer, type PeerOfferDto, type PeerOfferInput } from "./offers"

export type ProductCardDto = {
  productId: string
  title: string
  /** URL handle for /product/{slug}-{id}; null on rows predating slugs. */
  slug: string | null
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
  /**
   * Mean of published review ratings for this product, and how many there are.
   *
   * Optional because the catalogue itself stores no ratings — the route that
   * serves cards joins them in. Null/absent means "nobody has rated it yet",
   * which is different from a zero and must render as nothing at all.
   */
  ratingAvg?: number | null
  ratingCount?: number
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
  /** URL handle; canonicalRef is the link the UI must share/index. */
  slug: string | null
  canonicalRef: string
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
  /**
   * Phase 1B identity (ADR-002). UIs hide comparison language unless
   * `comparisonEligible` is true; the seller is never the brand.
   */
  identity: {
    brand: string | null
    model: string | null
    manufacturer: string | null
    productType: string | null
    identityConfidence: "identified" | "matched" | "seller_specific"
    comparisonEligible: boolean
  }
}

export type ProductCardInput = {
  productId: string
  title: string
  slug?: string | null
  categoryHandle: string
  categoryName: string
  imageUrl: string | null
  createdAt?: string | null
}

export type ProductDetailInput = {
  productId: string
  title: string
  slug?: string | null
  description: string | null
  categoryHandle: string
  categoryName: string
  imageUrls: string[]
  attributes?: { label: string; value: string }[]
  identity?: {
    brand?: string | null
    model?: string | null
    manufacturer?: string | null
    productType?: string | null
    identityConfidence?: "identified" | "matched" | "seller_specific" | null
  }
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
    slug: product.slug ?? null,
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
  const confidence = product.identity?.identityConfidence ?? "seller_specific"
  return {
    productId: product.productId,
    title: product.title,
    description: product.description,
    slug: product.slug ?? null,
    canonicalRef: product.slug
      ? `${product.slug}-${product.productId}`
      : product.productId,
    categoryHandle: product.categoryHandle,
    categoryName: product.categoryName,
    imageUrls: product.imageUrls,
    attributes: product.attributes ?? [],
    identity: {
      brand: product.identity?.brand ?? null,
      model: product.identity?.model ?? null,
      manufacturer: product.identity?.manufacturer ?? null,
      productType: product.identity?.productType ?? null,
      identityConfidence: confidence,
      comparisonEligible: confidence === "identified" || confidence === "matched",
    },
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
