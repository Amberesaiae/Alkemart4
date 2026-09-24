import { GHANA_CATEGORY_SEED, type CategorySeedRow } from "@alkemart/db"
import type { ProductStatus, SellerStatus } from "@alkemart/domain"
import { marketCurrency } from "@alkemart/shared/markets"

export type CatalogCategory = CategorySeedRow & {
  /** Lifecycle (Phase 1A); absent on rows that predate the columns. */
  code?: string | null
  displayName?: string | null
  slug?: string | null
  level?: number | null
  status?: "proposed" | "active" | "deprecated" | null
  isBrowseable?: boolean | null
  isAssignable?: boolean | null
  isNavVisible?: boolean | null
  attributeProfileId?: string | null
  replacementNodeId?: string | null
  sortOrder?: number | null
  version?: number | null
  /** Google product category ID (0034); null when unmapped. */
  googleCategoryId?: number | null
}

export type CatalogSeller = {
  id: string
  handle: string
  name: string
  status: SellerStatus
  commissionBps: number
  deliveryFeePesewas: bigint
  availability: "open" | "paused"
  pausedUntil: string | null
  pauseNote: string | null
  /** Pinpoint shop location (0035); null until the seller drops a pin. */
  lat?: number | null
  lng?: number | null
  district?: string | null
}

export type CatalogProduct = {
  id: string
  title: string
  description: string | null
  /** URL handle; absent on fixtures and rows predating the slug column. */
  slug?: string | null
  /** Structured facts ({label,value}[]); absent on rows that predate the column. */
  attributes?: { label: string; value: string }[]
  status: ProductStatus
  primaryCategoryId: string
  sellerId: string | null
  imageUrl?: string | null
  /** ISO string in snapshots; Date in Postgres rows. */
  createdAt?: string | null
  /** Identity (Phase 1B / ADR-002); absent reads as seller_specific. */
  brand?: string | null
  model?: string | null
  gtin?: string | null
  mpn?: string | null
  manufacturer?: string | null
  productType?: string | null
  identityConfidence?: "identified" | "matched" | "seller_specific" | null
  identityProvenance?: Record<string, unknown> | null
}

export type CatalogVariant = {
  id: string
  productId: string
  sku: string | null
  title: string | null
  imageUrl?: string | null
  weightGrams?: number | null
  gtin?: string | null
}

export type CatalogProductOption = {
  id: string
  productId: string
  name: string
  position: number
}

export type CatalogProductOptionValue = {
  id: string
  optionId: string
  value: string
  position: number
  imageUrl: string | null
}

export type CatalogVariantOptionValue = {
  variantId: string
  valueId: string
}

export type CatalogOffer = {
  id: string
  sellerId: string
  productId: string
  variantId: string
  pricePesewas: bigint
  onHand: number
  reserved: number
  currency: string
  active: boolean
  /** Offer terms (Phase 3A); absent reads as unknown — never fabricated. */
  condition?: string | null
  compareAtPesewas?: bigint | null
  compareAtProvenance?: string | null
  fulfillmentOrigin?: string | null
  warrantyRef?: string | null
  returnsRef?: string | null
  deliveryPromise?: string | null
  freshnessAt?: string | null
  publishedAt?: string | null
}

export type CatalogAttributeDefinition = {
  id: string
  code: string
  label: string
  type: "text" | "number" | "boolean" | "option" | "multi_option"
  unitFamily?: string | null
  allowedValues?: string[] | null
  filterable: boolean
  searchable: boolean
  required: boolean
  variantAxis: boolean
  visibleOnCard: boolean
  visibleOnPdp: boolean
  /** `universal` survives a category change; `profile` is pruned (0033). */
  scope?: "universal" | "profile"
}

export type CatalogAttributeProfile = {
  id: string
  name: string
  categoryId?: string | null
  version: number
}

export type CatalogProfileAttribute = {
  id: string
  profileId: string
  definitionId: string
  position: number
  required: boolean
}

export type CatalogProductAttributeValue = {
  id: string
  productId: string
  definitionId: string
  textValue?: string | null
  numberValue?: number | null
  booleanValue?: boolean | null
  optionValues?: string[] | null
  unit?: string | null
}

export type CatalogMatchCandidate = {
  id: string
  productId: string
  candidateProductId: string
  source: string
  evidence?: Record<string, unknown> | null
  status: "proposed" | "confirmed" | "rejected"
  reviewerId?: string | null
  reviewedAt?: string | null
  createdAt: string
}

/** Approved-or-pending query vocabulary (Phase 2C). */
export type CatalogSearchAlias = {
  id: string
  term: string
  target: string
  type: "synonym" | "redirect"
  status: "proposed" | "approved" | "rejected"
  reviewerId?: string | null
  reviewedAt?: string | null
  createdAt: string
}

/** Decomposed seller verification evidence (Phase 3D). */
export type CatalogSellerVerification = {
  id: string
  sellerId: string
  kind: "contact" | "identity" | "business" | "brand_auth" | "fulfillment_proven"
  status: "pending" | "verified" | "revoked" | "expired"
  evidence?: string | null
  issuedBy?: string | null
  issuedAt?: string | null
  expiresAt?: string | null
  revokedAt?: string | null
  revokeReason?: string | null
  createdAt: string
}

/** Append-only price log (Phase 3A integrity). */
export type CatalogPriceHistory = {
  id: string
  offerId: string
  oldPricePesewas: string
  newPricePesewas: string
  changedBy?: string | null
  createdAt: string
}

/** One gallery image (migration 0032). Ordered by `position`. */
export type CatalogProductImage = {
  id: string
  productId: string
  url: string
  alt?: string | null
  position: number
}

export type CatalogSnapshot = {
  categories: CatalogCategory[]
  sellers: CatalogSeller[]
  products: CatalogProduct[]
  variants: CatalogVariant[]
  offers: CatalogOffer[]
  productOptions: CatalogProductOption[]
  productOptionValues: CatalogProductOptionValue[]
  variantOptionValues: CatalogVariantOptionValue[]
  attributeDefinitions: CatalogAttributeDefinition[]
  attributeProfiles: CatalogAttributeProfile[]
  profileAttributes: CatalogProfileAttribute[]
  productAttributeValues: CatalogProductAttributeValue[]
  matchCandidates: CatalogMatchCandidate[]
  searchAliases: CatalogSearchAlias[]
  verifications: CatalogSellerVerification[]
  priceHistory: CatalogPriceHistory[]
  /** Optional: absent on fixtures and before migration 0032. */
  productImages?: CatalogProductImage[]
}

export type JsonCatalogSnapshot = {
  categories: CatalogCategory[]
  productOptions?: CatalogProductOption[]
  productOptionValues?: CatalogProductOptionValue[]
  variantOptionValues?: CatalogVariantOptionValue[]
  attributeDefinitions?: CatalogAttributeDefinition[]
  attributeProfiles?: CatalogAttributeProfile[]
  profileAttributes?: CatalogProfileAttribute[]
  productAttributeValues?: CatalogProductAttributeValue[]
  matchCandidates?: CatalogMatchCandidate[]
  searchAliases?: CatalogSearchAlias[]
  verifications?: CatalogSellerVerification[]
  priceHistory?: CatalogPriceHistory[]
  sellers: Array<Omit<CatalogSeller, "deliveryFeePesewas"> & { deliveryFeePesewas: string }>
  products: CatalogProduct[]
  variants: CatalogVariant[]
  offers: Array<
    Omit<CatalogOffer, "pricePesewas" | "compareAtPesewas"> & {
      pricePesewas: string
      compareAtPesewas?: string | null
    }
  >
}

/** 1 product, 2 sellers, 2 offers (seller-a cheaper). */
export function demoCatalog(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
    attributeDefinitions: [],
    attributeProfiles: [],
    profileAttributes: [],
    productAttributeValues: [],
    matchCandidates: [],
    searchAliases: [],
    verifications: [],
    priceHistory: [],
    sellers: [
      {
        id: "seller-a",
        handle: "seller-a",
        name: "Accra Mart",
        status: "open",
        commissionBps: 700,
        deliveryFeePesewas: 500n,
        availability: "open",
        pausedUntil: null,
        pauseNote: null,
      },
      {
        id: "seller-b",
        handle: "seller-b",
        name: "Kumasi Tech",
        status: "open",
        commissionBps: 700,
        deliveryFeePesewas: 800n,
        availability: "open",
        pausedUntil: null,
        pauseNote: null,
      },
    ],
    products: [
      {
        id: "prod-tecno-spark",
        title: "Tecno Spark",
        description: "Budget Android",
        status: "published",
        primaryCategoryId: "phones",
        sellerId: "seller-a",
      },
    ],
    variants: [
      {
        id: "var-tecno-spark",
        productId: "prod-tecno-spark",
        sku: "TECNO-SPARK",
        title: "Default",
      },
    ],
    offers: [
      {
        id: "offer-a",
        sellerId: "seller-a",
        productId: "prod-tecno-spark",
        variantId: "var-tecno-spark",
        pricePesewas: 1500n,
        onHand: 10,
        reserved: 0,
        currency: marketCurrency(),
        active: true,
      },
      {
        id: "offer-b",
        sellerId: "seller-b",
        productId: "prod-tecno-spark",
        variantId: "var-tecno-spark",
        pricePesewas: 3000n,
        onHand: 4,
        reserved: 0,
        currency: marketCurrency(),
        active: true,
      },
    ],
  }
}

export function snapshotToJson(data: CatalogSnapshot): JsonCatalogSnapshot {
  return {
    categories: data.categories,
    productOptions: data.productOptions,
    productOptionValues: data.productOptionValues,
    variantOptionValues: data.variantOptionValues,
    attributeDefinitions: data.attributeDefinitions,
    attributeProfiles: data.attributeProfiles,
    profileAttributes: data.profileAttributes,
    productAttributeValues: data.productAttributeValues,
    matchCandidates: data.matchCandidates,
    searchAliases: data.searchAliases,
    verifications: data.verifications,
    priceHistory: data.priceHistory,
    sellers: data.sellers.map((s) => ({
      ...s,
      deliveryFeePesewas: s.deliveryFeePesewas.toString(),
    })),
    products: data.products,
    variants: data.variants,
    offers: data.offers.map((o) => ({
      ...o,
      pricePesewas: o.pricePesewas.toString(),
      compareAtPesewas: o.compareAtPesewas?.toString() ?? null,
    })),
  }
}

export function snapshotFromJson(json: JsonCatalogSnapshot): CatalogSnapshot {
  return {
    categories: json.categories,
    productOptions: json.productOptions ?? [],
    productOptionValues: json.productOptionValues ?? [],
    variantOptionValues: json.variantOptionValues ?? [],
    attributeDefinitions: json.attributeDefinitions ?? [],
    attributeProfiles: json.attributeProfiles ?? [],
    profileAttributes: json.profileAttributes ?? [],
    productAttributeValues: json.productAttributeValues ?? [],
    matchCandidates: json.matchCandidates ?? [],
    searchAliases: json.searchAliases ?? [],
    verifications: json.verifications ?? [],
    priceHistory: json.priceHistory ?? [],
    sellers: json.sellers.map((s) => ({
      ...s,
      status: s.status,
      deliveryFeePesewas: BigInt(s.deliveryFeePesewas),
    })),
    products: json.products,
    variants: json.variants,
    offers: json.offers.map((o) => ({
      ...o,
      pricePesewas: BigInt(o.pricePesewas),
      compareAtPesewas:
        o.compareAtPesewas != null ? BigInt(o.compareAtPesewas as unknown as string) : null,
    })),
  }
}
