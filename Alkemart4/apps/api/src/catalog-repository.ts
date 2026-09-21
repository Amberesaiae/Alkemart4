import {
  attributeDefinitions,
  attributeProfiles,
  categories,
  moderationAppeals,
  offers,
  productAttributeValues,
  productMatchCandidates,
  productOptions,
  productOptionValues,
  products,
  productVariants,
  profileAttributes,
  reviews,
  sellers,
  shopFeatured,
  shopViews,
  variantOptionValues,
} from "@alkemart/db"
import {
  activateCategory,
  approveProduct,
  assertAssignableCategory,
  assertLeafCategory,
  buildNavTree,
  canShowComparison,
  deprecateCategory,
  isSellable,
  promoteIdentityConfidence,
  proposeProduct,
  rejectProduct,
  requestProductChanges,
  resolveCategoryRedirect,
  toProductCard,
  toProductDetail,
  validateAttributeValue,
  type AttributeType,
  type CategoryNode,
  type IdentityConfidence,
  type PeerOfferInput,
  type ProductCardDto,
  type ProductDetailDto,
  type ProductStatus,
} from "@alkemart/domain"
import { and, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { flagCatalogProduct, flaggingContext, type ProductFlag } from "./moderation-flags"
import {
  buildVariantMatrix,
  comboLabel,
  InvalidVariantMatrixError,
  MAX_COMBOS,
  MAX_OPTION_TYPES,
  MAX_OPTION_VALUE,
  normalizeOptionSpecs,
  type OptionSpec,
} from "./variant-matrix"
import { attributesFromJson } from "@alkemart/shared/product-attributes"
import type {
  CatalogAttributeDefinition,
  CatalogAttributeProfile,
  CatalogMatchCandidate,
  CatalogOffer,
  CatalogProduct,
  CatalogProductAttributeValue,
  CatalogSnapshot,
  CatalogVariant,
} from "./demo-seed"

export type CatalogSort = "newest" | "price_asc" | "price_desc"

export type CatalogListQuery = {
  category?: string
  /** Case-insensitive title substring filter (Workers search). */
  q?: string
  limit: number
  offset: number
  /** Default ordering stays title-asc (stable across pages). */
  sort?: CatalogSort
}

export type CatalogListDto = {
  items: ProductCardDto[]
  total: number
}

export type SellerShopTrust = {
  /** Mean of published review ratings across the seller's products. */
  ratingAvg: number | null
  ratingCount: number
  /** Fulfilled order count (social proof, not revenue). */
  salesCount: number
  memberSince: string | null
  location: string | null
  /** Short keyword tagline from the seller's storefront settings. */
  tagline: string | null
  phone: string | null
  hours: { days: string; open: string; close: string } | null
  social: { instagram?: string; facebook?: string; tiktok?: string; whatsapp?: string }
  /** Currently-active shop announcement text (Etsy-style, high conversion impact). */
  announcement: string | null
  policy: { shipping?: string; returnsDays?: number; warranty?: string } | null
  recentReviews: {
    productTitle: string
    rating: number
    title: string | null
    body: string
    createdAt: string
  }[]
}

export type SellerShopDto = {
  seller: {
    id: string
    handle: string
    name: string
    availability: { state: "open" | "paused"; pausedUntil: string | null; note: string | null }
    description: string | null
    logo: string | null
    banner: string | null
    /** Trust bundle; null when the route couldn't assemble it (shop still renders). */
    trust: SellerShopTrust | null
  }
  featuredProductIds: string[]
  items: ProductCardDto[]
}

export type VendorOfferDto = {
  id: string
  sellerId: string
  productId: string
  variantId: string
  pricePesewas: string
  onHand: number
  reserved: number
  currency: "ghs"
  active: boolean
}

export type ProductOptionDto = {
  id: string
  name: string
  values: { id: string; value: string; imageUrl: string | null }[]
}

export type ProductComboDto = {
  variant: {
    id: string
    sku: string | null
    title: string | null
  }
  offer: VendorOfferDto
  /** Option name → value for this combo (spec order). */
  options: Record<string, string>
}

export type VendorProductDto = {
  product: {
    id: string
    title: string
    description: string | null
    status: ProductStatus
    primaryCategoryId: string
    sellerId: string | null
    imageUrl: string | null
    attributes: { label: string; value: string }[]
  }
  variant: {
    id: string
    sku: string | null
    title: string | null
  }
  offer: VendorOfferDto
  /** Option types + values (empty for legacy single-variant products). */
  options: ProductOptionDto[]
  /** Every combo with its offer; legacy `variant`/`offer` mirror the first. */
  variants: ProductComboDto[]
}

export type VariantOptionInput = {
  name: string
  values: string[]
}

export type VariantEntryInput = {
  /** Option name → value; must match a generated combo exactly. */
  options: Record<string, string>
  pricePesewas?: bigint
  quantity?: number
  sku?: string | null
}

export type CreateVendorProductInput = {
  sellerId: string
  title: string
  description: string | null
  primaryCategoryId: string
  pricePesewas: bigint
  onHand: number
  sku?: string | null
  variantTitle?: string | null
  imageUrl?: string | null
  variantOptions?: VariantOptionInput[]
  variantEntries?: VariantEntryInput[]
  attributes?: { label: string; value: string }[]
  /** Phase 1B enrichment at publish (Level C default; no barcode required). */
  identity?: UpdateProductIdentityInput
}

export type UpdateProductVariantInput = {
  pricePesewas?: bigint
  onHand?: number
  active?: boolean
}

export type AddOptionValueInput = {
  optionId?: string
  optionName?: string
  value: string
  /** Required when introducing a brand-new option type: labels every existing combo. */
  existingValue?: string
}

export type UpdateVendorProductInput = {
  title?: string
  description?: string | null
  primaryCategoryId?: string
  pricePesewas?: bigint
  onHand?: number
  active?: boolean
  sku?: string | null
  variantTitle?: string | null
  imageUrl?: string | null
  /** Structured facts; an empty list clears them. */
  attributes?: { label: string; value: string }[]
}

export type AdminProductDto = {
  id: string
  title: string
  description: string | null
  status: ProductStatus
  primaryCategoryId: string
  sellerId: string | null
  imageUrl: string | null
}

export type AdminProductModerationAction = "approve" | "reject" | "request_changes"

/** Phase 1A — governed taxonomy node (ADR-001/002). */
export type TaxonomyNodeDto = {
  id: string
  code: string | null
  canonicalName: string
  displayName: string | null
  slug: string | null
  handle: string
  parentId: string | null
  level: number
  status: "proposed" | "active" | "deprecated"
  isBrowseable: boolean
  isAssignable: boolean
  isNavVisible: boolean
  attributeProfileId: string | null
  replacementNodeId: string | null
  sortOrder: number
  version: number
}

export type CreateTaxonomyNodeInput = {
  code: string
  name: string
  displayName?: string | null
  slug?: string | null
  handle?: string | null
  parentId?: string | null
  isBrowseable?: boolean
  isAssignable?: boolean
  isNavVisible?: boolean
  attributeProfileId?: string | null
  sortOrder?: number
}

export type UpdateTaxonomyNodeInput = {
  name?: string
  displayName?: string | null
  slug?: string | null
  parentId?: string | null
  isBrowseable?: boolean
  isAssignable?: boolean
  isNavVisible?: boolean
  attributeProfileId?: string | null
  sortOrder?: number
  /** Activation only (proposed → active). Deprecation uses deprecateTaxonomyNode. */
  status?: "active"
}

/** Phase 1B — product identity (ADR-002). */
export type ProductIdentityDto = {
  productId: string
  brand: string | null
  model: string | null
  gtin: string | null
  mpn: string | null
  manufacturer: string | null
  productType: string | null
  identityConfidence: IdentityConfidence
  /** Exact comparison renders only when true. */
  comparisonEligible: boolean
}

export type UpdateProductIdentityInput = {
  brand?: string | null
  model?: string | null
  gtin?: string | null
  mpn?: string | null
  manufacturer?: string | null
  productType?: string | null
}

/** Phase 1C — typed attributes. */
export type AttributeDefinitionDto = {
  id: string
  code: string
  label: string
  type: AttributeType
  unitFamily: string | null
  allowedValues: string[] | null
  filterable: boolean
  searchable: boolean
  required: boolean
  variantAxis: boolean
  visibleOnCard: boolean
  visibleOnPdp: boolean
}

export type CreateAttributeDefinitionInput = {
  code: string
  label: string
  type: AttributeType
  unitFamily?: string | null
  allowedValues?: string[] | null
  filterable?: boolean
  searchable?: boolean
  required?: boolean
  variantAxis?: boolean
  visibleOnCard?: boolean
  visibleOnPdp?: boolean
}

export type AttributeProfileDto = {
  id: string
  name: string
  categoryId: string | null
  version: number
  definitions: Array<{
    definitionId: string
    code: string
    position: number
    required: boolean
  }>
}

export type ProductAttributeValueDto = {
  definitionId: string
  code: string
  textValue: string | null
  numberValue: number | null
  booleanValue: boolean | null
  optionValues: string[] | null
  unit: string | null
}

export type SetProductAttributeValueInput = {
  definitionId: string
  textValue?: string | null
  numberValue?: number | null
  booleanValue?: boolean | null
  optionValues?: string[] | null
  unit?: string | null
}

/** Phase 1D — match candidates. */
export type MatchCandidateDto = {
  id: string
  productId: string
  candidateProductId: string
  source: string
  evidence: Record<string, unknown> | null
  status: "proposed" | "confirmed" | "rejected"
  reviewerId: string | null
  reviewedAt: string | null
  createdAt: string
}

export class CatalogConflictError extends Error {
  constructor(message = "offer already exists") {
    super(message)
    this.name = "CatalogConflictError"
  }
}

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CatalogValidationError"
  }
}

/**
 * Per-isolate snapshot cache for public catalog reads. The db handle is cached
 * per connection string (see db.ts), so this survives across requests on one
 * isolate. Short TTL: mutations invalidate explicitly, and vendor/admin writes
 * run on the primary handle anyway.
 */
const SNAPSHOT_TTL_MS = 5_000
const catalogSnapshotCache = new WeakMap<
  PostgresJsDatabase,
  { at: number; data: CatalogSnapshot }
>()

function invalidateSnapshot(...dbs: PostgresJsDatabase[]): void {
  for (const db of dbs) catalogSnapshotCache.delete(db)
}

export interface CatalogRepository {
  listCategories(): Promise<CategoryNode[]>
  listCatalog(query: CatalogListQuery): Promise<CatalogListDto>
  getProduct(
    id: string,
    reviews?: { rating: number; title: string | null; body: string; vendorResponse: string | null; createdAt: Date }[],
  ): Promise<ProductDetailDto | null>
  getSellerShop(handle: string): Promise<SellerShopDto | null>
  listOpenSellers(): Promise<Array<{ id: string; handle: string; name: string }>>
  /** Cards for an explicit id set (shop featured picks, manual shelves). */
  productCardsByIds(ids: readonly string[]): Promise<Map<string, ProductCardDto>>
  createVendorProduct(input: CreateVendorProductInput): Promise<VendorProductDto>
  updateVendorProduct(
    sellerId: string,
    productId: string,
    patch: UpdateVendorProductInput,
  ): Promise<VendorProductDto | null>
  proposeVendorProduct(sellerId: string, productId: string): Promise<VendorProductDto | null>
  updateProductVariant(
    sellerId: string,
    productId: string,
    variantId: string,
    patch: { pricePesewas?: bigint; onHand?: number; active?: boolean },
  ): Promise<VendorProductDto | null>
  addProductOptionValue(
    sellerId: string,
    productId: string,
    input: { optionId?: string; optionName?: string; value: string; existingValue?: string },
  ): Promise<VendorProductDto | null>
  /**
   * Delete a product with every combo, option, and offer. Callers must
   * refuse first when order history exists (money trail). Dependent
   * moderation/review/feature rows go with it.
   */
  deleteVendorProduct(sellerId: string, productId: string): Promise<boolean>;
  /**
   * Set/clear a swatch photo on one option value. Visual change, so a
   * published listing goes back for re-review (like product image edits).
   */
  setOptionValueImage(
    sellerId: string,
    productId: string,
    valueId: string,
    imageUrl: string | null,
  ): Promise<VendorProductDto | null>
  listVendorProducts(sellerId: string): Promise<VendorProductDto[]>
  listAdminProducts(status?: ProductStatus): Promise<AdminProductDto[]>
  listAdminProductsWithFlags(status?: ProductStatus): Promise<(AdminProductDto & { flags: ProductFlag[] })[]>
  moderateProduct(
    productId: string,
    action: AdminProductModerationAction,
  ): Promise<AdminProductDto | null>
  /**
   * Full product detail for admin review (options + combos included so
   * moderators see variant listings, not just the base product).
   */
  getAdminProductDetail(productId: string): Promise<VendorProductDto | null>
  // ── Phase 1A: taxonomy lifecycle ──
  listTaxonomyNodes(): Promise<TaxonomyNodeDto[]>
  createTaxonomyNode(input: CreateTaxonomyNodeInput): Promise<TaxonomyNodeDto>
  updateTaxonomyNode(id: string, patch: UpdateTaxonomyNodeInput): Promise<TaxonomyNodeDto | null>
  deprecateTaxonomyNode(id: string, replacementId: string): Promise<TaxonomyNodeDto | null>
  /** Follow deprecation redirects for a slug or id; null when unknown/unresolvable. */
  resolveCategoryRedirect(slugOrId: string): Promise<{ id: string; slug: string | null } | null>
  // ── Phase 1B: product identity (ADR-002) ──
  /** Seller enrichment (brand/model/…) or admin edit; scope enforces ownership. */
  updateProductIdentity(
    productId: string,
    patch: UpdateProductIdentityInput,
    scope: { sellerId: string } | { admin: true },
  ): Promise<ProductIdentityDto | null>
  /** Reviewed promotion along seller_specific → matched → identified. */
  promoteProductIdentity(
    productId: string,
    confidence: IdentityConfidence,
    reviewerId: string,
  ): Promise<ProductIdentityDto | null>
  // ── Phase 1C: typed attributes ──
  listAttributeDefinitions(): Promise<AttributeDefinitionDto[]>
  createAttributeDefinition(input: CreateAttributeDefinitionInput): Promise<AttributeDefinitionDto>
  listAttributeProfiles(): Promise<AttributeProfileDto[]>
  createAttributeProfile(input: {
    name: string
    categoryId?: string | null
    definitions: Array<{ definitionId: string; position?: number; required?: boolean }>
  }): Promise<AttributeProfileDto>
  listProductAttributeValues(productId: string): Promise<ProductAttributeValueDto[]>
  setProductAttributeValues(
    productId: string,
    values: SetProductAttributeValueInput[],
    scope: { sellerId: string } | { admin: true },
  ): Promise<ProductAttributeValueDto[]>
  // ── Phase 1D: match candidates ──
  proposeMatchCandidate(
    productId: string,
    candidateProductId: string,
    source: string,
    evidence?: Record<string, unknown> | null,
  ): Promise<MatchCandidateDto>
  listMatchCandidates(status?: "proposed" | "confirmed" | "rejected"): Promise<MatchCandidateDto[]>
  reviewMatchCandidate(
    id: string,
    decision: "confirmed" | "rejected",
    reviewerId: string,
  ): Promise<MatchCandidateDto | null>
}
function toBigInt(value: bigint | string | number): bigint {
  return typeof value === "bigint" ? value : BigInt(value)
}

function findCategoryNode(roots: CategoryNode[], id: string): CategoryNode | null {
  for (const node of roots) {
    if (node.id === id) return node
    const hit = findCategoryNode(node.children, id)
    if (hit) return hit
  }
  return null
}

function assertLeafCategoryId(
  categoryRows: CatalogSnapshot["categories"],
  categoryId: string,
): void {
  const row = categoryRows.find((c) => c.id === categoryId)
  if (!row) throw new CatalogValidationError("unknown category")
  // Phase 1A: sellers publish only into active, assignable nodes.
  try {
    assertAssignableCategory({
      id: row.id,
      status: taxonomyStatusOf(row),
      isAssignable: row.isAssignable ?? true,
    })
  } catch {
    throw new CatalogValidationError("category is not assignable")
  }
  const tree = buildNavTree(categoryRows.filter((c) => c.isNav))
  const node = findCategoryNode(tree, categoryId)
  if (!node) throw new CatalogValidationError("unknown category")
  try {
    assertLeafCategory(node)
  } catch {
    throw new CatalogValidationError("category must be a leaf")
  }
}

function toOfferDto(offer: CatalogOffer): VendorOfferDto {
  return {
    id: offer.id,
    sellerId: offer.sellerId,
    productId: offer.productId,
    variantId: offer.variantId,
    pricePesewas: offer.pricePesewas.toString(),
    onHand: offer.onHand,
    reserved: offer.reserved,
    currency: "ghs",
    active: offer.active,
  }
}

type ExtrasData = Pick<
  CatalogSnapshot,
  "productOptions" | "productOptionValues" | "variantOptionValues" | "variants" | "offers"
>

/** Full option structure + every combo for one product. */
function assembleExtras(
  data: ExtrasData,
  productId: string,
): { options: ProductOptionDto[]; variants: ProductComboDto[] } {
  const opts = data.productOptions
    .filter((o) => o.productId === productId)
    .sort((a, b) => a.position - b.position)
  const options: ProductOptionDto[] = opts.map((o) => ({
    id: o.id,
    name: o.name,
    values: data.productOptionValues
      .filter((v) => v.optionId === o.id)
      .sort((a, b) => a.position - b.position)
      .map((v) => ({ id: v.id, value: v.value, imageUrl: v.imageUrl ?? null })),
  }))
  const valueById = new Map(data.productOptionValues.map((v) => [v.id, v]))
  const optionById = new Map(opts.map((o) => [o.id, o]))
  const variants: ProductComboDto[] = data.variants
    .filter((v) => v.productId === productId)
    .flatMap((v) => {
      const offer = data.offers.find((o) => o.variantId === v.id)
      if (!offer) return []
      const map: Record<string, string> = {}
      for (const link of data.variantOptionValues.filter((l) => l.variantId === v.id)) {
        const val = valueById.get(link.valueId)
        const opt = val ? optionById.get(val.optionId) : undefined
        if (val && opt) map[opt.name] = val.value
      }
      return [
        {
          variant: { id: v.id, sku: v.sku, title: v.title },
          offer: toOfferDto(offer),
          options: map,
        },
      ]
    })
  return { options, variants }
}

function toVendorProductDto(
  product: CatalogProduct,
  variant: CatalogVariant,
  offer: CatalogOffer,
  extras?: { options: ProductOptionDto[]; variants: ProductComboDto[] },
): VendorProductDto {
  const baseVariant = { id: variant.id, sku: variant.sku, title: variant.title }
  const baseOffer = toOfferDto(offer)
  return {
    product: {
      id: product.id,
      title: product.title,
      description: product.description,
      status: product.status,
      primaryCategoryId: product.primaryCategoryId,
      sellerId: product.sellerId,
      imageUrl: product.imageUrl ?? null,
      attributes: attributesFromJson(product.attributes),
    },
    variant: baseVariant,
    offer: baseOffer,
    options: extras?.options ?? [],
    variants: extras?.variants ?? [{ variant: baseVariant, offer: baseOffer, options: {} }],
  }
}

/** Deterministic per-product SKU for generated combos. */
function comboSku(productId: string, index: number): string {
  return `v-${productId.slice(0, 8)}-${index + 1}`
}

function matrixError<T>(fn: () => T): T {
  try {
    return fn()
  } catch (err) {
    if (err instanceof InvalidVariantMatrixError) throw new CatalogValidationError(err.message)
    throw err
  }
}

export type ResolvedCombo = {
  combo: Record<string, string>
  pricePesewas: bigint
  onHand: number
  sku: string | null
}

/**
 * Match per-combo entry overrides onto generated combos. Unmatched entries
 * are vendor typos — 400, never silent.
 */
function resolveComboEntries(
  specs: OptionSpec[],
  entries: VariantEntryInput[],
  base: { pricePesewas: bigint; onHand: number },
): ResolvedCombo[] {
  const combos = buildVariantMatrix(specs)
  const norm = (v: string) => v.trim().toLowerCase()
  const remaining = entries.map((e) => ({
    keys: new Map(Object.entries(e.options).map(([k, v]) => [norm(k), norm(v)])),
    pricePesewas: e.pricePesewas,
    quantity: e.quantity,
    sku: e.sku ?? null,
  }))
  if (remaining.length > MAX_COMBOS) {
    throw new CatalogValidationError(`at most ${MAX_COMBOS} combo overrides`)
  }
  const matched = combos.map((combo) => {
    const keys = new Map(Object.entries(combo).map(([k, v]) => [norm(k), norm(v)]))
    const idx = remaining.findIndex(
      (e) =>
        e.keys.size === keys.size && [...e.keys].every(([k, v]) => keys.get(k) === v),
    )
    const entry = idx >= 0 ? remaining.splice(idx, 1)[0]! : null
    if (entry?.quantity !== undefined && (!Number.isInteger(entry.quantity) || entry.quantity < 0)) {
      throw new CatalogValidationError("combo quantity must be a whole number ≥ 0")
    }
    if (entry?.pricePesewas !== undefined && entry.pricePesewas < 0n) {
      throw new CatalogValidationError("combo price must be ≥ 0")
    }
    return {
      combo,
      pricePesewas: entry?.pricePesewas ?? base.pricePesewas,
      onHand: entry?.quantity ?? base.onHand,
      sku: entry?.sku?.trim() ? entry.sku.trim() : null,
    }
  })
  if (remaining.length > 0) {
    const stray = [...remaining[0]!.keys.entries()].map(([k, v]) => `${k}=${v}`).join(", ")
    throw new CatalogValidationError(`no such combination: ${stray}`)
  }
  return matched
}

function toAdminProductDto(product: CatalogProduct): AdminProductDto {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    status: product.status,
    primaryCategoryId: product.primaryCategoryId,
    sellerId: product.sellerId,
    imageUrl: product.imageUrl ?? null,
  }
}

function nextModerationStatus(
  status: ProductStatus,
  action: AdminProductModerationAction,
): ProductStatus {
  switch (action) {
    case "approve":
      return approveProduct(status)
    case "reject":
      return rejectProduct(status)
    case "request_changes":
      return requestProductChanges(status)
  }
}

// ── Phase 1 shared snapshot helpers ──

function taxonomyStatusOf(r: {
  status?: "proposed" | "active" | "deprecated" | null
}): "proposed" | "active" | "deprecated" {
  return r.status ?? "active"
}

function toTaxonomyNodeDto(r: CatalogSnapshot["categories"][number]): TaxonomyNodeDto {
  return {
    id: r.id,
    code: r.code ?? null,
    canonicalName: r.name,
    displayName: r.displayName ?? null,
    slug: r.slug ?? r.handle ?? null,
    handle: r.handle,
    parentId: r.parentId,
    level: r.level ?? 0,
    status: taxonomyStatusOf(r),
    isBrowseable: r.isBrowseable ?? true,
    isAssignable: r.isAssignable ?? true,
    isNavVisible: r.isNavVisible ?? r.isNav,
    attributeProfileId: r.attributeProfileId ?? null,
    replacementNodeId: r.replacementNodeId ?? null,
    sortOrder: r.sortOrder ?? r.rank,
    version: r.version ?? 1,
  }
}

function identityOfProduct(p: CatalogSnapshot["products"][number]): ProductIdentityDto {
  const confidence = p.identityConfidence ?? "seller_specific"
  return {
    productId: p.id,
    brand: p.brand ?? null,
    model: p.model ?? null,
    gtin: p.gtin ?? null,
    mpn: p.mpn ?? null,
    manufacturer: p.manufacturer ?? null,
    productType: p.productType ?? null,
    identityConfidence: confidence,
    comparisonEligible: canShowComparison(confidence),
  }
}

function toMatchCandidateDto(r: CatalogMatchCandidate): MatchCandidateDto {
  return {
    id: r.id,
    productId: r.productId,
    candidateProductId: r.candidateProductId,
    source: r.source,
    evidence: r.evidence ?? null,
    status: r.status,
    reviewerId: r.reviewerId ?? null,
    reviewedAt: r.reviewedAt ?? null,
    createdAt: r.createdAt,
  }
}

function definitionDto(r: CatalogAttributeDefinition): AttributeDefinitionDto {
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    type: r.type,
    unitFamily: r.unitFamily ?? null,
    allowedValues: r.allowedValues ?? null,
    filterable: r.filterable,
    searchable: r.searchable,
    required: r.required,
    variantAxis: r.variantAxis,
    visibleOnCard: r.visibleOnCard,
    visibleOnPdp: r.visibleOnPdp,
  }
}

function profileDto(
  data: Pick<
    CatalogSnapshot,
    "attributeProfiles" | "profileAttributes" | "attributeDefinitions"
  >,
  profile: CatalogAttributeProfile,
): AttributeProfileDto {
  const defById = new Map((data.attributeDefinitions ?? []).map((d) => [d.id, d]))
  return {
    id: profile.id,
    name: profile.name,
    categoryId: profile.categoryId ?? null,
    version: profile.version,
    definitions: (data.profileAttributes ?? [])
      .filter((l) => l.profileId === profile.id)
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        definitionId: l.definitionId,
        code: defById.get(l.definitionId)?.code ?? l.definitionId,
        position: l.position,
        required: l.required,
      })),
  }
}

function productAttributeValueDto(
  data: Pick<CatalogSnapshot, "attributeDefinitions">,
  row: CatalogProductAttributeValue,
): ProductAttributeValueDto {
  const def = (data.attributeDefinitions ?? []).find((d) => d.id === row.definitionId)
  return {
    definitionId: row.definitionId,
    code: def?.code ?? row.definitionId,
    textValue: row.textValue ?? null,
    numberValue: row.numberValue ?? null,
    booleanValue: row.booleanValue ?? null,
    optionValues: row.optionValues ?? null,
    unit: row.unit ?? null,
  }
}

/** Snapshot-based redirect resolution shared by both repositories. */
function resolveRedirectFromRows(
  categories: CatalogSnapshot["categories"],
  slugOrId: string,
): { id: string; slug: string | null } | null {
  const key = slugOrId.trim()
  const start = categories.find((c) => c.id === key || c.slug === key || c.handle === key)
  if (!start) return null
  const byId = new Map(
    categories.map(
      (c) =>
        [
          c.id,
          {
            id: c.id,
            status: taxonomyStatusOf(c),
            replacementNodeId: c.replacementNodeId ?? null,
          },
        ] as const,
    ),
  )
  const idMap = new Map(categories.map((c) => [c.id, c] as const))
  try {
    const id = resolveCategoryRedirect(start.id, byId)
    const node = idMap.get(id)!
    const dto = toTaxonomyNodeDto(node)
    return { id: dto.id, slug: dto.slug }
  } catch {
    return null
  }
}

function ensurePhase1Arrays(data: CatalogSnapshot): void {
  data.attributeDefinitions ??= []
  data.attributeProfiles ??= []
  data.profileAttributes ??= []
  data.productAttributeValues ??= []
  data.matchCandidates ??= []
}

function cleanText(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || crypto.randomUUID().slice(0, 8)
}

/** Depth from the parent chain (roots stay 0); guards against parent cycles. */
function taxonomyLevel(
  rows: CatalogSnapshot["categories"],
  parentId: string | null,
): number {
  let level = 0
  let current = parentId
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    level += 1
    current = rows.find((c) => c.id === current)?.parentId ?? null
  }
  return level
}

function sellerOwnsProduct(
  data: CatalogSnapshot,
  sellerId: string,
  productId: string,
): { product: CatalogProduct; variant: CatalogVariant; offer: CatalogOffer } | null {
  const product = data.products.find((p) => p.id === productId)
  if (!product) return null
  const offer = data.offers.find((o) => o.productId === productId && o.sellerId === sellerId)
  const viaProposership = product.sellerId === sellerId
  if (!offer && !viaProposership) return null
  if (!offer) return null
  const variant = data.variants.find((v) => v.id === offer.variantId)
  if (!variant) return null
  return { product, variant, offer }
}

function descendantIds(rows: CatalogSnapshot["categories"], handle: string): string[] | null {
  const tree = buildNavTree(rows.filter((c) => c.isNav))
  const find = (nodes: CategoryNode[]): CategoryNode | undefined => {
    for (const node of nodes) {
      if (node.handle === handle) return node
      const hit = find(node.children)
      if (hit) return hit
    }
    return undefined
  }
  const node = find(tree)
  if (!node) return null
  const ids: string[] = []
  const walk = (n: CategoryNode) => {
    ids.push(n.id)
    n.children.forEach(walk)
  }
  walk(node)
  return ids
}

function categoryById(data: CatalogSnapshot) {
  return new Map(data.categories.map((c) => [c.id, c]))
}

function sellablePeerOffers(
  data: CatalogSnapshot,
  offerOk: (offer: CatalogOffer) => boolean = () => true,
): Map<string, PeerOfferInput[]> {
  const sellerById = new Map(data.sellers.map((s) => [s.id, s]))
  const productById = new Map(data.products.map((p) => [p.id, p]))
  const byProduct = new Map<string, PeerOfferInput[]>()
  for (const offer of data.offers) {
    if (!offerOk(offer)) continue
    const seller = sellerById.get(offer.sellerId)
    const product = productById.get(offer.productId)
    if (!seller || !product) continue
    if (
      !isSellable({
        productStatus: product.status,
        sellerStatus: seller.status,
        offerActive: offer.active,
        onHand: offer.onHand,
        reserved: offer.reserved,
        pricePesewas: offer.pricePesewas,
      })
    ) {
      continue
    }
    const list = byProduct.get(offer.productId) ?? []
    list.push({
      offerId: offer.id,
      sellerId: seller.id,
      sellerHandle: seller.handle,
      sellerName: seller.name,
      pricePesewas: offer.pricePesewas,
      onHand: offer.onHand,
      reserved: offer.reserved,
      deliveryFeePesewas: seller.deliveryFeePesewas,
    })
    byProduct.set(offer.productId, list)
  }
  return byProduct
}

function cardInput(
  product: CatalogProduct,
  categoriesById: Map<string, CatalogSnapshot["categories"][number]>,
) {
  const cat = categoriesById.get(product.primaryCategoryId)
  return {
    productId: product.id,
    title: product.title,
    categoryHandle: cat?.handle ?? product.primaryCategoryId,
    categoryName: cat?.name ?? product.primaryCategoryId,
    imageUrl: product.imageUrl ?? null,
    createdAt: product.createdAt ?? null,
  }
}

function cardsFor(
  productRows: CatalogProduct[],
  data: CatalogSnapshot,
  offersByProduct: Map<string, PeerOfferInput[]>,
): ProductCardDto[] {
  const cats = categoryById(data)
  const cards: ProductCardDto[] = []
  for (const product of productRows) {
    const offerList = offersByProduct.get(product.id) ?? []
    if (offerList.length === 0) continue
    cards.push(toProductCard(cardInput(product, cats), offerList))
  }
  cards.sort((a, b) => a.title.localeCompare(b.title) || a.productId.localeCompare(b.productId))
  return cards
}

function applySort(cards: ProductCardDto[], sort?: CatalogSort): ProductCardDto[] {
  if (!sort) return cards
  const sorted = [...cards]
  if (sort === "price_asc" || sort === "price_desc") {
    const dir = sort === "price_asc" ? 1 : -1
    sorted.sort((a, b) => {
      const cmp =
        BigInt(a.fromPricePesewas) < BigInt(b.fromPricePesewas)
          ? -1
          : BigInt(a.fromPricePesewas) > BigInt(b.fromPricePesewas)
            ? 1
            : 0
      return cmp * dir || a.productId.localeCompare(b.productId)
    })
    return sorted
  }
  // newest — ISO strings sort lexically; missing timestamps sink to the end
  sorted.sort(
    (a, b) =>
      (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0) ||
      a.title.localeCompare(b.title) ||
      a.productId.localeCompare(b.productId),
  )
  return sorted
}

export function listCategoriesFrom(data: CatalogSnapshot): CategoryNode[] {
  return buildNavTree(data.categories.filter((c) => c.isNav))
}

export function listCatalogFrom(data: CatalogSnapshot, query: CatalogListQuery): CatalogListDto {
  let productRows = data.products
  if (query.category) {
    const ids = descendantIds(data.categories, query.category)
    if (!ids) return { items: [], total: 0 }
    const allowed = new Set(ids)
    productRows = productRows.filter((p) => allowed.has(p.primaryCategoryId))
  }
  const q = query.q?.trim().toLowerCase()
  if (q) {
    productRows = productRows.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    )
  }
  const cards = applySort(cardsFor(productRows, data, sellablePeerOffers(data)), query.sort)
  return {
    items: cards.slice(query.offset, query.offset + query.limit),
    total: cards.length,
  }
}

export function getProductFrom(
  data: CatalogSnapshot,
  id: string,
  reviews: { rating: number; title: string | null; body: string; vendorResponse: string | null; createdAt: Date }[] = [],
): ProductDetailDto | null {
  const product = data.products.find((p) => p.id === id)
  if (!product) return null
  const cat = categoryById(data).get(product.primaryCategoryId)
  const extras = assembleExtras(data, product.id)
  const optionMap = new Map<string, Record<string, string>>()
  for (const combo of extras.variants) {
    const offer = data.offers.find((o) => o.id === combo.offer.id)
    if (offer) optionMap.set(offer.id, combo.options)
  }
  const offersForProduct = (sellablePeerOffers(data).get(product.id) ?? []).map((o) => ({
    ...o,
    options: optionMap.get(o.offerId) ?? {},
  }))
  return toProductDetail(
    {
      productId: product.id,
      title: product.title,
      description: product.description,
      categoryHandle: cat?.handle ?? product.primaryCategoryId,
      categoryName: cat?.name ?? product.primaryCategoryId,
      imageUrls: product.imageUrl ? [product.imageUrl] : [],
      attributes: attributesFromJson(product.attributes),
      identity: {
        brand: product.brand ?? null,
        model: product.model ?? null,
        manufacturer: product.manufacturer ?? null,
        productType: product.productType ?? null,
        identityConfidence: product.identityConfidence ?? "seller_specific",
      },
    },
    offersForProduct,
    {
      optionTypes: extras.options.map((o) => ({
        name: o.name,
        values: o.values.map((v) => ({ value: v.value, imageUrl: v.imageUrl })),
      })),
      combos: data.offers
        .filter((o) => o.productId === product.id)
        .map((o) => ({
          offerId: o.id,
          sellerId: o.sellerId,
          options: optionMap.get(o.id) ?? {},
          pricePesewas: o.pricePesewas.toString(),
          availableQty: o.onHand - o.reserved,
          active: o.active,
        })),
      reviews,
    },
  )
}

export function getSellerShopFrom(data: CatalogSnapshot, handle: string): SellerShopDto | null {
  const seller = data.sellers.find((s) => s.handle === handle)
  if (!seller) return null
  const offersForSeller = sellablePeerOffers(data, (o) => o.sellerId === seller.id)
  const productIds = new Set(offersForSeller.keys())
  return {
    seller: {
      id: seller.id,
      handle: seller.handle,
      name: seller.name,
      availability: {
        state: seller.availability === "paused" ? "paused" : "open",
        pausedUntil: seller.pausedUntil,
        note: seller.pauseNote,
      },
      description: null,
      logo: null,
      banner: null,
      trust: null,
    },
    featuredProductIds: [],
    items: cardsFor(
      data.products.filter((p) => productIds.has(p.id)),
      data,
      offersForSeller,
    ),
  }
}

/**
 * Cards for an explicit set of product ids, in one pass.
 *
 * The stores index shows each shop's hand-picked items, so it needs cards for
 * a scattered handful of ids across many sellers. Fetching them shop by shop
 * would be a query per card; this reuses the same `cardsFor` projection the
 * listing endpoints use, so a featured tile and a grid tile cannot disagree.
 *
 * Products with no sellable offer are simply absent — a shop's pick that has
 * gone out of stock drops off the card rather than rendering as a dead tile.
 */
export function productCardsByIdsFrom(
  data: CatalogSnapshot,
  ids: readonly string[],
): Map<string, ProductCardDto> {
  const wanted = new Set(ids)
  if (wanted.size === 0) return new Map()
  const offers = sellablePeerOffers(data, () => true)
  const rows = data.products.filter((p) => wanted.has(p.id) && offers.has(p.id))
  const out = new Map<string, ProductCardDto>()
  for (const card of cardsFor(rows, data, offers)) {
    out.set(card.productId, card)
  }
  return out
}

export function listOpenSellersFrom(
  data: CatalogSnapshot,
): Array<{ id: string; handle: string; name: string }> {
  return data.sellers
    .filter((s) => s.status === "open")
    .map((s) => ({ id: s.id, handle: s.handle, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export class InMemoryCatalogRepository implements CatalogRepository {
  constructor(private readonly data: CatalogSnapshot) {}

  /** Shared mutable snapshot for in-memory checkout stock holds. */
  snapshot(): CatalogSnapshot {
    return this.data
  }

  async listCategories() {
    return listCategoriesFrom(this.data)
  }

  async listCatalog(query: CatalogListQuery) {
    return listCatalogFrom(this.data, query)
  }

  async getProduct(
    id: string,
    reviews: { rating: number; title: string | null; body: string; vendorResponse: string | null; createdAt: Date }[] = [],
  ) {
    return getProductFrom(this.data, id, reviews)
  }

  async getSellerShop(handle: string) {
    return getSellerShopFrom(this.data, handle)
  }

  async listOpenSellers() {
    return listOpenSellersFrom(this.data)
  }

  async productCardsByIds(ids: readonly string[]) {
    return productCardsByIdsFrom(this.data, ids)
  }

  async createVendorProduct(input: CreateVendorProductInput): Promise<VendorProductDto> {
    assertLeafCategoryId(this.data.categories, input.primaryCategoryId)
    const specs = matrixError(() =>
      normalizeOptionSpecs((input.variantOptions ?? []).map((o) => ({ name: o.name, values: o.values }))),
    )
    if (specs.length > 0 && (input.sku ?? null) !== null) {
      throw new CatalogValidationError("set SKUs per combination via variant entries, not on the product")
    }
    if (specs.length > 0 && (input.variantTitle ?? null) !== null) {
      throw new CatalogValidationError("combination titles derive from options")
    }
    // Resolve entries before mutating anything: typos 400 with a clean slate.
    const resolved = matrixError(() =>
      resolveComboEntries(specs, input.variantEntries ?? [], {
        pricePesewas: input.pricePesewas,
        onHand: input.onHand,
      }),
    )
    const productId = crypto.randomUUID()
    const product: CatalogProduct = {
      id: productId,
      title: input.title,
      description: input.description,
      status: "proposed",
      primaryCategoryId: input.primaryCategoryId,
      sellerId: input.sellerId,
      attributes: input.attributes ?? [],
      brand: cleanText(input.identity?.brand),
      model: cleanText(input.identity?.model),
      gtin: cleanText(input.identity?.gtin),
      mpn: cleanText(input.identity?.mpn),
      manufacturer: cleanText(input.identity?.manufacturer),
      productType: cleanText(input.identity?.productType),
      identityConfidence: "seller_specific",
    }
    this.data.products.push(product)
    if (specs.length === 0) {
      const variantId = crypto.randomUUID()
      const offerId = crypto.randomUUID()
      const variant: CatalogVariant = {
        id: variantId,
        productId,
        sku: input.sku ?? null,
        title: input.variantTitle ?? "Default",
      }
      const offer: CatalogOffer = {
        id: offerId,
        sellerId: input.sellerId,
        productId,
        variantId,
        pricePesewas: input.pricePesewas,
        onHand: input.onHand,
        reserved: 0,
        currency: "ghs",
        active: true,
      }
      const clash = this.data.offers.some(
        (o) =>
          o.sellerId === offer.sellerId &&
          o.productId === offer.productId &&
          o.variantId === offer.variantId,
      )
      if (clash) throw new CatalogConflictError()
      this.data.variants.push(variant)
      this.data.offers.push(offer)
      return toVendorProductDto(product, variant, offer, assembleExtras(this.data, productId))
    }
    const names = specs.map((o) => o.name)
    const valueIds = new Map<string, string>()
    specs.forEach((spec, oi) => {
      const optionId = crypto.randomUUID()
      this.data.productOptions.push({ id: optionId, productId, name: spec.name, position: oi })
      spec.values.forEach((value, vi) => {
        const valueId = crypto.randomUUID()
        this.data.productOptionValues.push({ id: valueId, optionId, value, position: vi, imageUrl: null })
        valueIds.set(`${optionId}|${value.toLowerCase()}`, valueId)
      })
    })
    const seenSkus = new Set<string>()
    resolved.forEach((r, i) => {
      const sku = r.sku ?? comboSku(productId, i)
      if (seenSkus.has(sku.toLowerCase())) throw new CatalogValidationError(`duplicate sku "${sku}"`)
      seenSkus.add(sku.toLowerCase())
      const variantId = crypto.randomUUID()
      this.data.variants.push({
        id: variantId,
        productId,
        sku,
        title: comboLabel(r.combo, names),
      })
      names.forEach((name, ni) => {
        const option = this.data.productOptions.find(
          (o) => o.productId === productId && o.name.toLowerCase() === name.toLowerCase(),
        )
        const valueId = valueIds.get(`${option!.id}|${r.combo[name]!.toLowerCase()}`)
        if (!valueId) throw new CatalogValidationError(`unknown option value "${r.combo[name]}"`)
        this.data.variantOptionValues.push({ variantId, valueId })
        void ni
      })
      this.data.offers.push({
        id: crypto.randomUUID(),
        sellerId: input.sellerId,
        productId,
        variantId,
        pricePesewas: r.pricePesewas,
        onHand: r.onHand,
        reserved: 0,
        currency: "ghs",
        active: true,
      })
    })
    return this.assembleOwnedProduct(productId)
  }

  private assembleOwnedProduct(productId: string): VendorProductDto {
    const product = this.data.products.find((p) => p.id === productId)
    if (!product) throw new Error("product not found")
    const extras = assembleExtras(this.data, productId)
    const first = extras.variants[0]
    if (!first) throw new Error("product has no variants")
    const variant = this.data.variants.find((v) => v.id === first.variant.id)!
    const offer = this.data.offers.find((o) => o.id === first.offer.id)!
    return toVendorProductDto(product, variant, offer, extras)
  }

  async getAdminProductDetail(productId: string): Promise<VendorProductDto | null> {
    if (!this.data.products.some((p) => p.id === productId)) return null
    return this.assembleOwnedProduct(productId)
  }

  // ── Phase 1A: taxonomy lifecycle (in-memory) ──

  async listTaxonomyNodes(): Promise<TaxonomyNodeDto[]> {
    return this.data.categories
      .map(toTaxonomyNodeDto)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.handle.localeCompare(b.handle))
  }

  async createTaxonomyNode(input: CreateTaxonomyNodeInput): Promise<TaxonomyNodeDto> {
    const code = input.code.trim()
    const name = input.name.trim()
    if (!code) throw new CatalogValidationError("code required")
    if (!name) throw new CatalogValidationError("name required")
    if (this.data.categories.some((c) => c.code === code)) {
      throw new CatalogConflictError("category code already exists")
    }
    const slug = cleanText(input.slug) ?? slugify(code)
    const handle = cleanText(input.handle) ?? slug
    if (this.data.categories.some((c) => c.handle === handle || c.slug === slug)) {
      throw new CatalogConflictError("category slug/handle already exists")
    }
    if (input.parentId !== undefined && input.parentId !== null) {
      if (!this.data.categories.some((c) => c.id === input.parentId)) {
        throw new CatalogValidationError("unknown parent category")
      }
    }
    const row: CatalogSnapshot["categories"][number] = {
      id: crypto.randomUUID(),
      handle,
      name,
      parentId: input.parentId ?? null,
      rank: input.sortOrder ?? 0,
      isNav: input.isNavVisible ?? true,
      code,
      displayName: cleanText(input.displayName),
      slug,
      level: 0,
      status: "proposed",
      isBrowseable: input.isBrowseable ?? true,
      isAssignable: input.isAssignable ?? true,
      isNavVisible: input.isNavVisible ?? true,
      attributeProfileId: cleanText(input.attributeProfileId),
      replacementNodeId: null,
      sortOrder: input.sortOrder ?? 0,
      version: 1,
    }
    // Level derives from the parent chain (roots stay 0).
    row.level = taxonomyLevel(this.data.categories, row.parentId)
    this.data.categories.push(row)
    return toTaxonomyNodeDto(row)
  }

  async updateTaxonomyNode(
    id: string,
    patch: UpdateTaxonomyNodeInput,
  ): Promise<TaxonomyNodeDto | null> {
    const row = this.data.categories.find((c) => c.id === id)
    if (!row) return null
    if (taxonomyStatusOf(row) === "deprecated") {
      throw new CatalogValidationError("deprecated categories are read-only; create a successor instead")
    }
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new CatalogValidationError("name required")
      row.name = patch.name.trim()
    }
    if (patch.displayName !== undefined) row.displayName = cleanText(patch.displayName)
    if (patch.slug !== undefined) {
      const slug = cleanText(patch.slug) ?? slugify(row.code ?? row.handle)
      if (this.data.categories.some((c) => c.id !== id && (c.slug === slug || c.handle === slug))) {
        throw new CatalogConflictError("category slug/handle already exists")
      }
      row.slug = slug
    }
    if (patch.parentId !== undefined) {
      if (patch.parentId !== null && !this.data.categories.some((c) => c.id === patch.parentId)) {
        throw new CatalogValidationError("unknown parent category")
      }
      if (patch.parentId === id) throw new CatalogValidationError("a category cannot parent itself")
      row.parentId = patch.parentId
      row.level = taxonomyLevel(this.data.categories, row.parentId)
    }
    if (patch.isBrowseable !== undefined) row.isBrowseable = patch.isBrowseable
    if (patch.isAssignable !== undefined) row.isAssignable = patch.isAssignable
    if (patch.isNavVisible !== undefined) {
      row.isNavVisible = patch.isNavVisible
      row.isNav = patch.isNavVisible
    }
    if (patch.attributeProfileId !== undefined) {
      row.attributeProfileId = cleanText(patch.attributeProfileId)
    }
    if (patch.sortOrder !== undefined) {
      row.sortOrder = patch.sortOrder
      row.rank = patch.sortOrder
    }
    if (patch.status !== undefined) {
      activateCategory({ id: row.id, status: taxonomyStatusOf(row) })
      row.status = "active"
    }
    row.version = (row.version ?? 1) + 1
    return toTaxonomyNodeDto(row)
  }

  async deprecateTaxonomyNode(id: string, replacementId: string): Promise<TaxonomyNodeDto | null> {
    const row = this.data.categories.find((c) => c.id === id)
    if (!row) return null
    const replacement = this.data.categories.find((c) => c.id === replacementId) ?? null
    deprecateCategory(
      { id: row.id, status: taxonomyStatusOf(row) },
      replacement
        ? { id: replacement.id, status: taxonomyStatusOf(replacement) }
        : null,
    )
    row.status = "deprecated"
    row.replacementNodeId = replacementId
    row.isNavVisible = false
    row.isNav = false
    row.version = (row.version ?? 1) + 1
    return toTaxonomyNodeDto(row)
  }

  async resolveCategoryRedirect(
    slugOrId: string,
  ): Promise<{ id: string; slug: string | null } | null> {
    return resolveRedirectFromRows(this.data.categories, slugOrId)
  }

  // ── Phase 1B: product identity (in-memory) ──

  async updateProductIdentity(
    productId: string,
    patch: UpdateProductIdentityInput,
    scope: { sellerId: string } | { admin: true },
  ): Promise<ProductIdentityDto | null> {
    const product = this.data.products.find((p) => p.id === productId)
    if (!product) return null
    if (!("admin" in scope)) {
      const owned = sellerOwnsProduct(this.data, scope.sellerId, productId)
      if (!owned) return null
    }
    if (patch.brand !== undefined) product.brand = cleanText(patch.brand)
    if (patch.model !== undefined) product.model = cleanText(patch.model)
    if (patch.gtin !== undefined) product.gtin = cleanText(patch.gtin)
    if (patch.mpn !== undefined) product.mpn = cleanText(patch.mpn)
    if (patch.manufacturer !== undefined) product.manufacturer = cleanText(patch.manufacturer)
    if (patch.productType !== undefined) product.productType = cleanText(patch.productType)
    return identityOfProduct(product)
  }

  async promoteProductIdentity(
    productId: string,
    confidence: IdentityConfidence,
    reviewerId: string,
  ): Promise<ProductIdentityDto | null> {
    const product = this.data.products.find((p) => p.id === productId)
    if (!product) return null
    const next = promoteIdentityConfidence(product.identityConfidence ?? "seller_specific", confidence, reviewerId)
    product.identityConfidence = next
    product.identityProvenance = {
      ...((product.identityProvenance as Record<string, unknown> | null) ?? {}),
      promotedBy: reviewerId,
      promotedAt: new Date().toISOString(),
      confidence: next,
    }
    return identityOfProduct(product)
  }

  // ── Phase 1C: typed attributes (in-memory) ──

  async listAttributeDefinitions(): Promise<AttributeDefinitionDto[]> {
    ensurePhase1Arrays(this.data)
    return this.data.attributeDefinitions.map(definitionDto)
  }

  async createAttributeDefinition(
    input: CreateAttributeDefinitionInput,
  ): Promise<AttributeDefinitionDto> {
    ensurePhase1Arrays(this.data)
    const code = input.code.trim()
    if (!code) throw new CatalogValidationError("code required")
    if (!input.label.trim()) throw new CatalogValidationError("label required")
    if (this.data.attributeDefinitions.some((d) => d.code.toLowerCase() === code.toLowerCase())) {
      throw new CatalogConflictError("attribute code already exists")
    }
    if (
      (input.type === "option" || input.type === "multi_option") &&
      (!input.allowedValues || input.allowedValues.length === 0)
    ) {
      throw new CatalogValidationError("option attributes require allowed values")
    }
    const row: CatalogAttributeDefinition = {
      id: crypto.randomUUID(),
      code,
      label: input.label.trim(),
      type: input.type,
      unitFamily: cleanText(input.unitFamily),
      allowedValues: input.allowedValues?.map((v) => v.trim()).filter(Boolean) ?? null,
      filterable: input.filterable ?? false,
      searchable: input.searchable ?? false,
      required: input.required ?? false,
      variantAxis: input.variantAxis ?? false,
      visibleOnCard: input.visibleOnCard ?? false,
      visibleOnPdp: input.visibleOnPdp ?? true,
    }
    this.data.attributeDefinitions.push(row)
    return definitionDto(row)
  }

  async listAttributeProfiles(): Promise<AttributeProfileDto[]> {
    ensurePhase1Arrays(this.data)
    return this.data.attributeProfiles.map((p) => profileDto(this.data, p))
  }

  async createAttributeProfile(input: {
    name: string
    categoryId?: string | null
    definitions: Array<{ definitionId: string; position?: number; required?: boolean }>
  }): Promise<AttributeProfileDto> {
    ensurePhase1Arrays(this.data)
    if (!input.name.trim()) throw new CatalogValidationError("name required")
    if (input.categoryId !== undefined && input.categoryId !== null) {
      if (!this.data.categories.some((c) => c.id === input.categoryId)) {
        throw new CatalogValidationError("unknown category")
      }
    }
    for (const link of input.definitions) {
      if (!this.data.attributeDefinitions.some((d) => d.id === link.definitionId)) {
        throw new CatalogValidationError(`unknown attribute definition ${link.definitionId}`)
      }
    }
    const profile: CatalogAttributeProfile = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      categoryId: input.categoryId ?? null,
      version: 1,
    }
    this.data.attributeProfiles.push(profile)
    input.definitions.forEach((link, i) => {
      this.data.profileAttributes.push({
        id: crypto.randomUUID(),
        profileId: profile.id,
        definitionId: link.definitionId,
        position: link.position ?? i,
        required: link.required ?? false,
      })
    })
    return profileDto(this.data, profile)
  }

  async listProductAttributeValues(productId: string): Promise<ProductAttributeValueDto[]> {
    ensurePhase1Arrays(this.data)
    return this.data.productAttributeValues
      .filter((v) => v.productId === productId)
      .map((v) => productAttributeValueDto(this.data, v))
  }

  async setProductAttributeValues(
    productId: string,
    values: SetProductAttributeValueInput[],
    scope: { sellerId: string } | { admin: true },
  ): Promise<ProductAttributeValueDto[]> {
    ensurePhase1Arrays(this.data)
    const product = this.data.products.find((p) => p.id === productId)
    if (!product) throw new CatalogValidationError("unknown product")
    if (!("admin" in scope)) {
      if (!sellerOwnsProduct(this.data, scope.sellerId, productId)) {
        throw new CatalogValidationError("not your product")
      }
    }
    const defById = new Map(this.data.attributeDefinitions.map((d) => [d.id, d]))
    for (const v of values) {
      const def = defById.get(v.definitionId)
      if (!def) throw new CatalogValidationError(`unknown attribute definition ${v.definitionId}`)
      validateAttributeValue(
        {
          id: def.id,
          code: def.code,
          type: def.type,
          allowedValues: def.allowedValues,
          required: def.required,
        },
        {
          textValue: v.textValue ?? null,
          numberValue: v.numberValue ?? null,
          booleanValue: v.booleanValue ?? null,
          optionValues: v.optionValues ?? null,
          unit: v.unit ?? null,
        },
      )
    }
    for (const v of values) {
      const existing = this.data.productAttributeValues.find(
        (r) => r.productId === productId && r.definitionId === v.definitionId,
      )
      const row = {
        textValue: v.textValue ?? null,
        numberValue: v.numberValue ?? null,
        booleanValue: v.booleanValue ?? null,
        optionValues: v.optionValues ?? null,
        unit: cleanText(v.unit),
      }
      if (existing) Object.assign(existing, row)
      else {
        this.data.productAttributeValues.push({
          id: crypto.randomUUID(),
          productId,
          definitionId: v.definitionId,
          ...row,
        })
      }
    }
    return this.listProductAttributeValues(productId)
  }

  // ── Phase 1D: match candidates (in-memory) ──

  async proposeMatchCandidate(
    productId: string,
    candidateProductId: string,
    source: string,
    evidence?: Record<string, unknown> | null,
  ): Promise<MatchCandidateDto> {
    ensurePhase1Arrays(this.data)
    if (productId === candidateProductId) {
      throw new CatalogValidationError("a product cannot match itself")
    }
    if (
      !this.data.products.some((p) => p.id === productId) ||
      !this.data.products.some((p) => p.id === candidateProductId)
    ) {
      throw new CatalogValidationError("unknown product")
    }
    const dupe = this.data.matchCandidates.find(
      (m) =>
        m.status === "proposed" &&
        ((m.productId === productId && m.candidateProductId === candidateProductId) ||
          (m.productId === candidateProductId && m.candidateProductId === productId)),
    )
    if (dupe) throw new CatalogConflictError("match already proposed")
    const row: CatalogMatchCandidate = {
      id: crypto.randomUUID(),
      productId,
      candidateProductId,
      source,
      evidence: evidence ?? null,
      status: "proposed",
      reviewerId: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    }
    this.data.matchCandidates.push(row)
    return toMatchCandidateDto(row)
  }

  async listMatchCandidates(
    status?: "proposed" | "confirmed" | "rejected",
  ): Promise<MatchCandidateDto[]> {
    ensurePhase1Arrays(this.data)
    return this.data.matchCandidates
      .filter((m) => !status || m.status === status)
      .map(toMatchCandidateDto)
  }

  async reviewMatchCandidate(
    id: string,
    decision: "confirmed" | "rejected",
    reviewerId: string,
  ): Promise<MatchCandidateDto | null> {
    ensurePhase1Arrays(this.data)
    const row = this.data.matchCandidates.find((m) => m.id === id)
    if (!row) return null
    if (row.status !== "proposed") {
      throw new CatalogValidationError("only proposed matches can be reviewed")
    }
    if (!reviewerId.trim()) throw new CatalogValidationError("reviewer required")
    row.status = decision
    row.reviewerId = reviewerId
    row.reviewedAt = new Date().toISOString()
    if (decision === "confirmed") {
      // Confirmation promotes both sides to matched (reviewed — ADR-002).
      for (const pid of [row.productId, row.candidateProductId]) {
        const product = this.data.products.find((p) => p.id === pid)
        if (product && (product.identityConfidence ?? "seller_specific") === "seller_specific") {
          product.identityConfidence = "matched"
          product.identityProvenance = {
            ...((product.identityProvenance as Record<string, unknown> | null) ?? {}),
            matchedBy: reviewerId,
            matchedAt: row.reviewedAt,
            matchCandidateId: row.id,
          }
        }
      }
    }
    return toMatchCandidateDto(row)
  }

  async updateVendorProduct(
    sellerId: string,
    productId: string,
    patch: UpdateVendorProductInput,
  ): Promise<VendorProductDto | null> {
    const owned = sellerOwnsProduct(this.data, sellerId, productId)
    if (!owned) return null
    if (
      assembleExtras(this.data, productId).options.length > 0 &&
      (patch.pricePesewas !== undefined ||
        patch.onHand !== undefined ||
        patch.active !== undefined ||
        patch.sku !== undefined ||
        patch.variantTitle !== undefined)
    ) {
      throw new CatalogValidationError(
        "this product has combinations - edit price, stock, SKUs and visibility per combination",
      )
    }
    if (patch.primaryCategoryId !== undefined) {
      assertLeafCategoryId(this.data.categories, patch.primaryCategoryId)
      owned.product.primaryCategoryId = patch.primaryCategoryId
    }
    if (patch.title !== undefined) owned.product.title = patch.title
    if (patch.description !== undefined) owned.product.description = patch.description
    if (patch.imageUrl !== undefined) owned.product.imageUrl = patch.imageUrl
    if (patch.attributes !== undefined) owned.product.attributes = patch.attributes
    if (patch.sku !== undefined) owned.variant.sku = patch.sku
    if (patch.variantTitle !== undefined) owned.variant.title = patch.variantTitle
    if (patch.pricePesewas !== undefined) owned.offer.pricePesewas = patch.pricePesewas
    if (patch.onHand !== undefined) owned.offer.onHand = patch.onHand
    if (patch.active !== undefined) owned.offer.active = patch.active
    // Content edits on a live listing send it back for re-review.
    if (
      owned.product.status === "published" &&
      (patch.title !== undefined ||
        patch.description !== undefined ||
        patch.primaryCategoryId !== undefined ||
        patch.imageUrl !== undefined ||
        patch.attributes !== undefined)
    ) {
      owned.product.status = "proposed"
    }
    return toVendorProductDto(
      owned.product,
      owned.variant,
      owned.offer,
      assembleExtras(this.data, productId),
    )
  }

  async updateProductVariant(
    sellerId: string,
    productId: string,
    variantId: string,
    patch: UpdateProductVariantInput,
  ): Promise<VendorProductDto | null> {
    const product = this.data.products.find((p) => p.id === productId && p.sellerId === sellerId)
    if (!product) return null
    const variant = this.data.variants.find((v) => v.id === variantId && v.productId === productId)
    if (!variant) return null
    const offer = this.data.offers.find((o) => o.variantId === variantId)
    if (!offer) return null
    if (patch.pricePesewas !== undefined) {
      if (patch.pricePesewas < 0n) throw new CatalogValidationError("price must be >= 0")
      offer.pricePesewas = patch.pricePesewas
    }
    if (patch.onHand !== undefined) {
      if (!Number.isInteger(patch.onHand) || patch.onHand < 0) {
        throw new CatalogValidationError("stock must be a whole number >= 0")
      }
      offer.onHand = patch.onHand
    }
    if (patch.active !== undefined) offer.active = patch.active
    return toVendorProductDto(product, variant, offer, assembleExtras(this.data, productId))
  }

  async addProductOptionValue(
    sellerId: string,
    productId: string,
    input: AddOptionValueInput,
  ): Promise<VendorProductDto | null> {
    const clean = (v: string) => v.trim().replace(/\s+/g, " ")
    const product = this.data.products.find((p) => p.id === productId && p.sellerId === sellerId)
    if (!product) return null
    const value = clean(input.value)
    if (!value) throw new CatalogValidationError("value is required")
    if (value.length > MAX_OPTION_VALUE) {
      throw new CatalogValidationError("option value exceeds " + MAX_OPTION_VALUE + " characters")
    }
    const existing = assembleExtras(this.data, productId)
    let option = input.optionId
      ? existing.options.find((o) => o.id === input.optionId)
      : input.optionName
        ? existing.options.find((o) => o.name.toLowerCase() === clean(input.optionName as string).toLowerCase())
        : undefined
    if (!option && input.optionId) throw new CatalogValidationError("unknown option")
    if (!option && (input.optionName || !input.optionId) && existing.options.length >= MAX_OPTION_TYPES) {
      throw new CatalogValidationError("at most " + MAX_OPTION_TYPES + " option types")
    }
    if (option && input.existingValue !== undefined) {
      throw new CatalogValidationError("existingValue only applies to brand-new option types")
    }
    let createdCombos = 0
    if (option) {
      if (option.values.some((v) => v.value.toLowerCase() === value.toLowerCase())) {
        const firstVariant = this.data.variants.find((v) => v.productId === productId)
        const firstOffer = this.data.offers.find((o) => o.productId === productId)
        if (!firstVariant || !firstOffer) throw new Error("product has no variants")
        return toVendorProductDto(product, firstVariant, firstOffer, existing)
      }
      const valueId = crypto.randomUUID()
      this.data.productOptionValues.push({ id: valueId, optionId: option.id, value, position: option.values.length, imageUrl: null })
      createdCombos = this.createCombosForValues(productId, [{ optionId: option.id, valueId }])
    } else {
      const existingValue = input.existingValue !== undefined ? clean(input.existingValue) : ""
      if (!existingValue) {
        throw new CatalogValidationError("existingValue labels your current listing - required for a new option type")
      }
      const optionName = clean(input.optionName ?? "Option")
      if (!optionName) throw new CatalogValidationError("option name is required")
      const optionId = crypto.randomUUID()
      this.data.productOptions.push({ id: optionId, productId, name: optionName, position: existing.options.length })
      const distinct = [...new Set([existingValue, value])]
      const valueIds = new Map<string, string>()
      distinct.forEach((v, vi) => {
        const valueId = crypto.randomUUID()
        this.data.productOptionValues.push({ id: valueId, optionId, value: v, position: vi, imageUrl: null })
        valueIds.set(v.toLowerCase(), valueId)
      })
      const labelId = valueIds.get(existingValue.toLowerCase()) as string
      for (const combo of existing.variants) {
        const linked = new Set(
          this.data.variantOptionValues
            .filter((l) => l.variantId === combo.variant.id)
            .map((l) => this.lookupValue(l.valueId).toLowerCase()),
        )
        void linked
        if (!this.data.variantOptionValues.some((l) => l.variantId === combo.variant.id && l.valueId === labelId)) {
          this.data.variantOptionValues.push({ variantId: combo.variant.id, valueId: labelId })
        }
      }
      const extra = distinct.filter((v) => v.toLowerCase() !== existingValue.toLowerCase())
      if (extra.length > 0) {
        createdCombos = this.createCombosForValues(
          productId,
          extra.map((v) => ({ optionId, valueId: valueIds.get(v.toLowerCase()) as string })),
        )
      }
    }
    if (createdCombos > 0 && product.status === "published") {
      product.status = "proposed"
    }
    return this.assembleOwnedProduct(productId)
  }

  /** Materialize new combos for fixed (optionId, valueId) pairs. */
  private createCombosForValues(
    productId: string,
    fixed: { optionId: string; valueId: string }[],
  ): number {
    const extras = assembleExtras(this.data, productId)
    const fixedOptionIds = new Set(fixed.map((f) => f.optionId))
    const others = extras.options.filter((o) => !fixedOptionIds.has(o.id))
    let base: Record<string, string>[] = [{}]
    for (const opt of others) {
      const next: Record<string, string>[] = []
      for (const combo of base) {
        for (const v of opt.values) next.push({ ...combo, [opt.name]: v.value })
      }
      base = next
    }
    const optNames = new Map(extras.options.map((o) => [o.id, o.name]))
    const fixedByOption = new Map<string, string[]>()
    for (const f of fixed) {
      const val = this.lookupValue(f.valueId)
      const arr = fixedByOption.get(f.optionId) ?? []
      arr.push(val)
      fixedByOption.set(f.optionId, arr)
    }
    let expanded: Record<string, string>[] = base
    for (const [optionId, vals] of fixedByOption) {
      const name = optNames.get(optionId) as string
      const next: Record<string, string>[] = []
      for (const c of expanded) for (const v of vals) next.push({ ...c, [name]: v })
      expanded = next
    }
    const sellerId = this.data.products.find((p) => p.id === productId)?.sellerId as string
    const startIndex = this.data.variants.filter((v) => v.productId === productId).length
    let created = 0
    for (const full of expanded) {
      const variantId = crypto.randomUUID()
      this.data.variants.push({
        id: variantId,
        productId,
        sku: comboSku(productId, startIndex + created),
        title: comboLabel(full, extras.options.map((o) => o.name)),
      })
      for (const entry of Object.entries(full)) {
        const opt = extras.options.find((o) => o.name.toLowerCase() === entry[0].toLowerCase())
        const valueId = this.data.productOptionValues.find(
          (r) => r.optionId === opt?.id && r.value.toLowerCase() === entry[1].toLowerCase(),
        )?.id
        if (valueId) this.data.variantOptionValues.push({ variantId, valueId })
      }
      // Sibling price: combo sharing every *other* value; fallback: first combo.
      const names = Object.keys(full)
      const sibling =
        extras.variants.find((c) =>
          names.every((k) => {
            const fixedForKey = [...fixedByOption].some(
              ([oid, vals]) =>
                optNames.get(oid)?.toLowerCase() === k.toLowerCase() &&
                vals.some((x) => x.toLowerCase() === (full[k] as string).toLowerCase()),
            )
            if (fixedForKey) return true
            return (c.options[k] ?? "").toLowerCase() === (full[k] as string).toLowerCase()
          }),
        ) ?? extras.variants[0]
      this.data.offers.push({
        id: crypto.randomUUID(),
        sellerId,
        productId,
        variantId,
        pricePesewas: sibling ? BigInt(sibling.offer.pricePesewas) : 0n,
        onHand: 0,
        reserved: 0,
        currency: "ghs",
        active: true,
      })
      created += 1
    }
    return created
  }

  private lookupValue(valueId: string): string {
    return this.data.productOptionValues.find((v) => v.id === valueId)?.value ?? ""
  }

  async deleteVendorProduct(sellerId: string, productId: string): Promise<boolean> {
    const product = this.data.products.find((p) => p.id === productId && p.sellerId === sellerId)
    if (!product) return false
    const variantIds = new Set(this.data.variants.filter((v) => v.productId === productId).map((v) => v.id))
    this.data.offers = this.data.offers.filter((o) => o.productId !== productId)
    this.data.variantOptionValues = this.data.variantOptionValues.filter((l) => !variantIds.has(l.variantId))
    this.data.variants = this.data.variants.filter((v) => v.productId !== productId)
    const optionIds = new Set(
      this.data.productOptions.filter((o) => o.productId === productId).map((o) => o.id),
    )
    this.data.productOptionValues = this.data.productOptionValues.filter((v) => !optionIds.has(v.optionId))
    this.data.productOptions = this.data.productOptions.filter((o) => o.productId !== productId)
    this.data.products = this.data.products.filter((p) => p.id !== productId)
    return true
  }

  async setOptionValueImage(
    sellerId: string,
    productId: string,
    valueId: string,
    imageUrl: string | null,
  ): Promise<VendorProductDto | null> {
    const product = this.data.products.find((p) => p.id === productId && p.sellerId === sellerId)
    if (!product) return null
    const row = this.data.productOptionValues.find((v) => v.id === valueId)
    const option = row ? this.data.productOptions.find((o) => o.id === row.optionId && o.productId === productId) : undefined
    if (!row || !option) return null
    if ((row.imageUrl ?? null) !== imageUrl) {
      row.imageUrl = imageUrl
      if (product.status === "published") product.status = "proposed"
    }
    return this.assembleOwnedProduct(productId)
  }

  async proposeVendorProduct(
    sellerId: string,
    productId: string,
  ): Promise<VendorProductDto | null> {
    const owned = sellerOwnsProduct(this.data, sellerId, productId)
    if (!owned) return null
    owned.product.status = proposeProduct(owned.product.status)
    return toVendorProductDto(
      owned.product,
      owned.variant,
      owned.offer,
      assembleExtras(this.data, productId),
    )
  }

  async listVendorProducts(sellerId: string): Promise<VendorProductDto[]> {
    const items: VendorProductDto[] = []
    for (const offer of this.data.offers) {
      if (offer.sellerId !== sellerId) continue
      const product = this.data.products.find((p) => p.id === offer.productId)
      const variant = this.data.variants.find((v) => v.id === offer.variantId)
      if (!product || !variant) continue
      items.push(toVendorProductDto(product, variant, offer))
    }
    items.sort((a, b) => a.product.title.localeCompare(b.product.title))
    return items
  }

  async listAdminProducts(status?: ProductStatus): Promise<AdminProductDto[]> {
    return this.data.products
      .filter((p) => (status ? p.status === status : true))
      .map(toAdminProductDto)
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  async listAdminProductsWithFlags(status?: ProductStatus) {
    const ctx = flaggingContext(
      this.data.products.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        primaryCategoryId: p.primaryCategoryId,
        sellerId: p.sellerId,
      })),
      this.data.offers.map((o) => ({
        productId: o.productId,
        pricePesewas: o.pricePesewas,
        onHand: o.onHand,
        active: o.active,
      })),
    )
    return this.data.products
      .filter((p) => (status ? p.status === status : true))
      .map((p) => ({
        ...toAdminProductDto(p),
        flags: flagCatalogProduct(
          {
            id: p.id,
            title: p.title,
            description: p.description,
            imageUrl: p.imageUrl,
            primaryCategoryId: p.primaryCategoryId,
            sellerId: p.sellerId,
          },
          ctx,
        ),
      }))
      .sort((a, b) => b.flags.length - a.flags.length || a.title.localeCompare(b.title))
  }

  async moderateProduct(
    productId: string,
    action: AdminProductModerationAction,
  ): Promise<AdminProductDto | null> {
    const product = this.data.products.find((p) => p.id === productId)
    if (!product) return null
    product.status = nextModerationStatus(product.status, action)
    return toAdminProductDto(product)
  }
}

export class PostgresCatalogRepository implements CatalogRepository {
  /**
   * `db` is the (possibly cached) catalog read binding; `writeDb` is required —
   * the primary binding for mutations and their read-after-write reads. Hyperdrive
   * query caching on the catalog binding can serve a pre-write snapshot, which
   * previously made createVendorProduct's read-back observe stale rows (live 500s).
   * See ACID-DATAFLOW.md: money/stock/RYW ops must use HYPERDRIVE_PRIMARY.
   */
  constructor(
    private readonly db: PostgresJsDatabase,
    private readonly writeDb: PostgresJsDatabase,
  ) {}

  private get wdb(): PostgresJsDatabase {
    return this.writeDb
  }

  private async load(db: PostgresJsDatabase = this.db): Promise<CatalogSnapshot> {
    if (db === this.db) {
      // Full-catalog snapshot cache (per isolate, short TTL). Public reads hit
      // this multiple times per request; writes invalidate via invalidateSnapshot.
      const cached = catalogSnapshotCache.get(db)
      if (cached && Date.now() - cached.at < SNAPSHOT_TTL_MS) return cached.data
      const fresh = await this.loadFresh(db)
      catalogSnapshotCache.set(db, { at: Date.now(), data: fresh })
      return fresh
    }
    return this.loadFresh(db)
  }

  private async loadFresh(db: PostgresJsDatabase): Promise<CatalogSnapshot> {
    const [categoryRows, sellerRows, productRows, variantRows, offerRows] = await Promise.all([
      db.select().from(categories),
      db.select().from(sellers),
      db.select().from(products),
      db.select().from(productVariants),
      db.select().from(offers),
    ])
    // Option tables are newer than the base schema: a database that has not
    // run migration 0016 yet must keep serving the catalog, so these reads
    // degrade to empty instead of failing the whole snapshot. Writes to new
    // endpoints still require the migration (and 400/500 honestly if absent).
    type OptionRow = typeof productOptions.$inferSelect
    type OptionValueRow = typeof productOptionValues.$inferSelect
    type VariantLinkRow = typeof variantOptionValues.$inferSelect
    const [optionRows, valueRows, linkRows]: [OptionRow[], OptionValueRow[], VariantLinkRow[]] =
      await Promise.all([
        db.select().from(productOptions).catch((): OptionRow[] => []),
        db.select().from(productOptionValues).catch((): OptionValueRow[] => []),
        db.select().from(variantOptionValues).catch((): VariantLinkRow[] => []),
      ])
    // Phase 1 tables are newer than the base schema: databases that have not
    // run migration 0020 yet keep serving the catalog with these degrading
    // to empty. Writes to the new endpoints require 0020 (400/500 honestly
    // if absent) — apply via POST /admin/migrate/blueprint-phase1.
    type AttrDefRow = typeof attributeDefinitions.$inferSelect
    type AttrProfileRow = typeof attributeProfiles.$inferSelect
    type ProfileAttrRow = typeof profileAttributes.$inferSelect
    type AttrValueRow = typeof productAttributeValues.$inferSelect
    type MatchRow = typeof productMatchCandidates.$inferSelect
    const [attrDefRows, attrProfileRows, profileAttrRows, attrValueRows, matchRows]: [
      AttrDefRow[],
      AttrProfileRow[],
      ProfileAttrRow[],
      AttrValueRow[],
      MatchRow[],
    ] = await Promise.all([
      db.select().from(attributeDefinitions).catch((): AttrDefRow[] => []),
      db.select().from(attributeProfiles).catch((): AttrProfileRow[] => []),
      db.select().from(profileAttributes).catch((): ProfileAttrRow[] => []),
      db.select().from(productAttributeValues).catch((): AttrValueRow[] => []),
      db.select().from(productMatchCandidates).catch((): MatchRow[] => []),
    ])
    return {
      categories: categoryRows.map((r) => ({
        id: r.id,
        handle: r.handle,
        name: r.name,
        parentId: r.parentId,
        rank: r.rank,
        isNav: r.isNav,
        code: r.code,
        displayName: r.displayName,
        slug: r.slug,
        level: r.level,
        status: r.status,
        isBrowseable: r.isBrowseable,
        isAssignable: r.isAssignable,
        isNavVisible: r.isNavVisible,
        attributeProfileId: r.attributeProfileId,
        replacementNodeId: r.replacementNodeId,
        sortOrder: r.sortOrder,
        version: r.version,
      })),
      sellers: sellerRows.map((r) => ({
        id: r.id,
        handle: r.handle,
        name: r.name,
        status: r.status,
        commissionBps: r.commissionBps,
        deliveryFeePesewas: toBigInt(r.deliveryFeePesewas),
        availability: r.availability === "paused" ? ("paused" as const) : ("open" as const),
        pausedUntil: r.pausedUntil ? r.pausedUntil.toISOString() : null,
        pauseNote: r.pauseNote ?? null,
      })),
      products: productRows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        primaryCategoryId: r.primaryCategoryId,
        sellerId: r.sellerId,
        imageUrl: r.imageUrl,
        attributes: attributesFromJson(r.attributes),
        createdAt: r.createdAt ? r.createdAt.toISOString() : null,
        brand: r.brand,
        model: r.model,
        gtin: r.gtin,
        mpn: r.mpn,
        manufacturer: r.manufacturer,
        productType: r.productType,
        identityConfidence: r.identityConfidence,
        identityProvenance: (r.identityProvenance as Record<string, unknown> | null) ?? null,
      })),
      variants: variantRows.map((r) => ({
        id: r.id,
        productId: r.productId,
        sku: r.sku,
        title: r.title,
        imageUrl: r.imageUrl,
        weightGrams: r.weightGrams,
        gtin: r.gtin,
      })),
      offers: offerRows.map((r) => ({
        id: r.id,
        sellerId: r.sellerId,
        productId: r.productId,
        variantId: r.variantId,
        pricePesewas: toBigInt(r.pricePesewas),
        onHand: r.onHand,
        reserved: r.reserved,
        currency: r.currency,
        active: r.active,
        condition: r.condition,
        compareAtPesewas: r.compareAtPesewas != null ? toBigInt(r.compareAtPesewas) : null,
        compareAtProvenance: r.compareAtProvenance,
        fulfillmentOrigin: r.fulfillmentOrigin,
        warrantyRef: r.warrantyRef,
        returnsRef: r.returnsRef,
        deliveryPromise: r.deliveryPromise,
        freshnessAt: r.freshnessAt ? r.freshnessAt.toISOString() : null,
        publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      })),
      productOptions: optionRows.map((r) => ({
        id: r.id,
        productId: r.productId,
        name: r.name,
        position: r.position,
      })),
      productOptionValues: valueRows.map((r) => ({
        id: r.id,
        optionId: r.optionId,
        value: r.value,
        position: r.position,
        imageUrl: r.imageUrl ?? null,
      })),
      variantOptionValues: linkRows.map((r) => ({
        variantId: r.variantId,
        valueId: r.valueId,
      })),
      attributeDefinitions: attrDefRows.map((r) => ({
        id: r.id,
        code: r.code,
        label: r.label,
        type: r.type,
        unitFamily: r.unitFamily,
        allowedValues: (r.allowedValues as string[] | null) ?? null,
        filterable: r.filterable,
        searchable: r.searchable,
        required: r.required,
        variantAxis: r.variantAxis,
        visibleOnCard: r.visibleOnCard,
        visibleOnPdp: r.visibleOnPdp,
      })),
      attributeProfiles: attrProfileRows.map((r) => ({
        id: r.id,
        name: r.name,
        categoryId: r.categoryId,
        version: r.version,
      })),
      profileAttributes: profileAttrRows.map((r) => ({
        id: r.id,
        profileId: r.profileId,
        definitionId: r.definitionId,
        position: r.position,
        required: r.required,
      })),
      productAttributeValues: attrValueRows.map((r) => ({
        id: r.id,
        productId: r.productId,
        definitionId: r.definitionId,
        textValue: r.textValue,
        numberValue: r.numberValue,
        booleanValue: r.booleanValue,
        optionValues: (r.optionValues as string[] | null) ?? null,
        unit: r.unit,
      })),
      matchCandidates: matchRows.map((r) => ({
        id: r.id,
        productId: r.productId,
        candidateProductId: r.candidateProductId,
        source: r.source,
        evidence: (r.evidence as Record<string, unknown> | null) ?? null,
        status: r.status,
        reviewerId: r.reviewerId,
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
        createdAt: r.createdAt ? r.createdAt.toISOString() : new Date(0).toISOString(),
      })),
    }
  }

  async listCategories() {
    return listCategoriesFrom(await this.load())
  }

  async listCatalog(query: CatalogListQuery) {
    return listCatalogFrom(await this.load(), query)
  }

  async getProduct(
    id: string,
    reviews: { rating: number; title: string | null; body: string; vendorResponse: string | null; createdAt: Date }[] = [],
  ) {
    return getProductFrom(await this.load(), id, reviews)
  }

  async getSellerShop(handle: string) {
    return getSellerShopFrom(await this.load(), handle)
  }

  async listOpenSellers() {
    return listOpenSellersFrom(await this.load())
  }

  async productCardsByIds(ids: readonly string[]) {
    return productCardsByIdsFrom(await this.load(), ids)
  }

  private async requireLeafCategory(categoryId: string) {
    const categoryRows = await this.db.select().from(categories)
    assertLeafCategoryId(
      categoryRows.map((r) => ({
        id: r.id,
        handle: r.handle,
        name: r.name,
        parentId: r.parentId,
        rank: r.rank,
        isNav: r.isNav,
      })),
      categoryId,
    )
  }

  private async loadOwnedVendorProduct(
    sellerId: string,
    productId: string,
    db: PostgresJsDatabase = this.db,
  ): Promise<VendorProductDto | null> {
    const data = await this.load(db)
    const owned = sellerOwnsProduct(data, sellerId, productId)
    if (!owned) return null
    return toVendorProductDto(owned.product, owned.variant, owned.offer, assembleExtras(data, productId))
  }

  /** Fresh option structure for planning writes (bypasses the snapshot cache). */
  private async freshExtras(productId: string): Promise<{ options: ProductOptionDto[]; variants: ProductComboDto[] }> {
    const data = await this.load(this.wdb)
    return assembleExtras(data, productId)
  }

  async createVendorProduct(input: CreateVendorProductInput): Promise<VendorProductDto> {
    await this.requireLeafCategory(input.primaryCategoryId)
    const specs = matrixError(() =>
      normalizeOptionSpecs((input.variantOptions ?? []).map((o) => ({ name: o.name, values: o.values }))),
    )
    if (specs.length > 0 && (input.sku ?? null) !== null) {
      throw new CatalogValidationError("set SKUs per combination via variant entries, not on the product")
    }
    if (specs.length > 0 && (input.variantTitle ?? null) !== null) {
      throw new CatalogValidationError("combination titles derive from options")
    }
    const resolved = matrixError(() =>
      resolveComboEntries(specs, input.variantEntries ?? [], {
        pricePesewas: input.pricePesewas,
        onHand: input.onHand,
      }),
    )
    const productId = crypto.randomUUID()
    const seenSkus = new Set<string>()
    for (const r of resolved) {
      const sku = r.sku ?? comboSku(productId, resolved.indexOf(r))
      if (seenSkus.has(sku.toLowerCase())) throw new CatalogValidationError('duplicate sku "' + sku + '"')
      seenSkus.add(sku.toLowerCase())
    }
    try {
      await this.wdb.transaction(async (tx) => {
        await tx.insert(products).values({
          id: productId,
          title: input.title,
          description: input.description,
          status: "proposed",
          primaryCategoryId: input.primaryCategoryId,
          sellerId: input.sellerId,
          imageUrl: input.imageUrl ?? null,
          attributes: input.attributes ?? null,
          brand: cleanText(input.identity?.brand),
          model: cleanText(input.identity?.model),
          gtin: cleanText(input.identity?.gtin),
          mpn: cleanText(input.identity?.mpn),
          manufacturer: cleanText(input.identity?.manufacturer),
          productType: cleanText(input.identity?.productType),
          identityConfidence: "seller_specific",
        })
        if (specs.length === 0) {
          const variantId = crypto.randomUUID()
          await tx.insert(productVariants).values({
            id: variantId,
            productId,
            sku: input.sku ?? null,
            title: input.variantTitle ?? "Default",
          })
          await tx.insert(offers).values({
            id: crypto.randomUUID(),
            sellerId: input.sellerId,
            productId,
            variantId,
            pricePesewas: input.pricePesewas,
            onHand: input.onHand,
            reserved: 0,
            currency: "ghs",
            active: true,
          })
          return
        }
        const names = specs.map((o) => o.name)
        const valueIds = new Map<string, string>()
        const optionIdByName = new Map<string, string>()
        for (const [oi, spec] of specs.entries()) {
          const optionId = crypto.randomUUID()
          optionIdByName.set(spec.name.toLowerCase(), optionId)
          await tx.insert(productOptions).values({ id: optionId, productId, name: spec.name, position: oi })
          for (const [vi, value] of spec.values.entries()) {
            const valueId = crypto.randomUUID()
            await tx
              .insert(productOptionValues)
              .values({ id: valueId, optionId, value, position: vi })
            valueIds.set(optionId + "|" + value.toLowerCase(), valueId)
          }
        }
        for (const [i, r] of resolved.entries()) {
          const variantId = crypto.randomUUID()
          await tx.insert(productVariants).values({
            id: variantId,
            productId,
            sku: r.sku ?? comboSku(productId, i),
            title: comboLabel(r.combo, names),
          })
          for (const name of names) {
            const optionId = optionIdByName.get(name.toLowerCase()) as string
            const valueId = valueIds.get(optionId + "|" + (r.combo[name] as string).toLowerCase())
            if (!valueId) throw new CatalogValidationError('unknown option value "' + r.combo[name] + '"')
            await tx.insert(variantOptionValues).values({ id: crypto.randomUUID(), variantId, valueId })
          }
          await tx.insert(offers).values({
            id: crypto.randomUUID(),
            sellerId: input.sellerId,
            productId,
            variantId,
            pricePesewas: r.pricePesewas,
            onHand: r.onHand,
            reserved: 0,
            currency: "ghs",
            active: true,
          })
        }
      })
    } catch (err) {
      if (err instanceof CatalogValidationError) throw err
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("product_variants_sku") && message.includes("23505")) {
        throw new CatalogConflictError("sku already exists")
      }
      if (message.includes("offers_seller_product_variant_uidx") || message.includes("23505")) {
        throw new CatalogConflictError()
      }
      throw err
    }
    invalidateSnapshot(this.wdb, this.db)
    // Read back via primary: the cached catalog binding may not see the insert yet.
    const created = await this.loadOwnedVendorProduct(input.sellerId, productId, this.wdb)
    if (!created) throw new Error("failed to create vendor product")
    return created
  }

  async updateVendorProduct(
    sellerId: string,
    productId: string,
    patch: UpdateVendorProductInput,
  ): Promise<VendorProductDto | null> {
    // Ownership pre-read via primary: a just-created product may be invisible to the cached binding.
    const owned = await this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
    if (!owned) return null
    if (
      owned.options.length > 0 &&
      (patch.pricePesewas !== undefined ||
        patch.onHand !== undefined ||
        patch.active !== undefined ||
        patch.sku !== undefined ||
        patch.variantTitle !== undefined)
    ) {
      throw new CatalogValidationError(
        "this product has combinations - edit price, stock, SKUs and visibility per combination",
      )
    }
    if (patch.primaryCategoryId !== undefined) {
      await this.requireLeafCategory(patch.primaryCategoryId)
    }
    await this.wdb.transaction(async (tx) => {
      const productPatch: Partial<{
        title: string
        description: string | null
        primaryCategoryId: string
        imageUrl: string | null
        attributes: { label: string; value: string }[] | null
      }> = {}
      if (patch.title !== undefined) productPatch.title = patch.title
      if (patch.description !== undefined) productPatch.description = patch.description
      if (patch.primaryCategoryId !== undefined) {
        productPatch.primaryCategoryId = patch.primaryCategoryId
      }
      if (patch.imageUrl !== undefined) productPatch.imageUrl = patch.imageUrl
      if (patch.attributes !== undefined) productPatch.attributes = patch.attributes
      if (Object.keys(productPatch).length > 0) {
        await tx.update(products).set(productPatch).where(eq(products.id, productId))
      }

      const variantPatch: Partial<{ sku: string | null; title: string | null }> = {}
      if (patch.sku !== undefined) variantPatch.sku = patch.sku
      if (patch.variantTitle !== undefined) variantPatch.title = patch.variantTitle
      if (Object.keys(variantPatch).length > 0) {
        await tx
          .update(productVariants)
          .set(variantPatch)
          .where(eq(productVariants.id, owned.variant.id))
      }

      const offerPatch: Partial<{
        pricePesewas: bigint
        onHand: number
        active: boolean
      }> = {}
      if (patch.pricePesewas !== undefined) offerPatch.pricePesewas = patch.pricePesewas
      if (patch.onHand !== undefined) offerPatch.onHand = patch.onHand
      if (patch.active !== undefined) offerPatch.active = patch.active
      if (Object.keys(offerPatch).length > 0) {
        await tx.update(offers).set(offerPatch).where(eq(offers.id, owned.offer.id))
      }

      // Content edits on a live listing send it back for re-review.
      // Price/stock-only edits stay live.
      if (
        owned.product.status === "published" &&
        (patch.title !== undefined ||
          patch.description !== undefined ||
          patch.primaryCategoryId !== undefined ||
          patch.imageUrl !== undefined)
      ) {
        await tx.update(products).set({ status: "proposed" }).where(eq(products.id, productId))
      }
    })
    invalidateSnapshot(this.wdb, this.db)
    return this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
  }

  async deleteVendorProduct(sellerId: string, productId: string): Promise<boolean> {
    const owned = await this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
    if (!owned) return false
    await this.wdb.transaction(async (tx) => {
      const variantRows = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.productId, productId))
      const variantIds = variantRows.map((r) => r.id)
      if (variantIds.length > 0) {
        await tx.delete(variantOptionValues).where(inArray(variantOptionValues.variantId, variantIds))
        await tx.delete(offers).where(inArray(offers.variantId, variantIds))
        await tx.delete(productVariants).where(inArray(productVariants.id, variantIds))
      }
      const optionRows = await tx
        .select({ id: productOptions.id })
        .from(productOptions)
        .where(eq(productOptions.productId, productId))
      const optionIds = optionRows.map((r) => r.id)
      if (optionIds.length > 0) {
        await tx.delete(productOptionValues).where(inArray(productOptionValues.optionId, optionIds))
        await tx.delete(productOptions).where(inArray(productOptions.id, optionIds))
      }
      await tx.delete(shopFeatured).where(eq(shopFeatured.productId, productId))
      await tx.delete(moderationAppeals).where(eq(moderationAppeals.productId, productId))
      await tx.delete(reviews).where(eq(reviews.productId, productId))
      await tx.delete(shopViews).where(eq(shopViews.productId, productId))
      await tx.delete(products).where(eq(products.id, productId))
    })
    invalidateSnapshot(this.wdb, this.db)
    return true
  }

  async setOptionValueImage(
    sellerId: string,
    productId: string,
    valueId: string,
    imageUrl: string | null,
  ): Promise<VendorProductDto | null> {
    const rows = await this.wdb
      .select({ valueId: productOptionValues.id, current: productOptionValues.imageUrl, status: products.status })
      .from(productOptionValues)
      .innerJoin(productOptions, eq(productOptions.id, productOptionValues.optionId))
      .innerJoin(products, eq(products.id, productOptions.productId))
      .where(
        and(
          eq(productOptionValues.id, valueId),
          eq(productOptions.productId, productId),
          eq(products.id, productId),
          eq(products.sellerId, sellerId),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row) return null
    if ((row.current ?? null) !== imageUrl) {
      await this.wdb.update(productOptionValues).set({ imageUrl }).where(eq(productOptionValues.id, valueId))
      if (row.status === "published") {
        await this.wdb.update(products).set({ status: "proposed" }).where(eq(products.id, productId))
      }
      invalidateSnapshot(this.wdb, this.db)
    }
    return this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
  }

  async proposeVendorProduct(
    sellerId: string,
    productId: string,
  ): Promise<VendorProductDto | null> {
    const owned = await this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
    if (!owned) return null
    const next = proposeProduct(owned.product.status)
    await this.wdb.update(products).set({ status: next }).where(eq(products.id, productId))
    invalidateSnapshot(this.wdb, this.db)
    return this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
  }

  async listVendorProducts(sellerId: string): Promise<VendorProductDto[]> {
    const data = await this.load()
    const memo = new Map<string, { options: ProductOptionDto[]; variants: ProductComboDto[] }>()
    const items: VendorProductDto[] = []
    for (const offer of data.offers) {
      if (offer.sellerId !== sellerId) continue
      const product = data.products.find((p) => p.id === offer.productId)
      const variant = data.variants.find((v) => v.id === offer.variantId)
      if (!product || !variant) continue
      let extras = memo.get(product.id)
      if (!extras) {
        extras = assembleExtras(data, product.id)
        memo.set(product.id, extras)
      }
      items.push(toVendorProductDto(product, variant, offer, extras))
    }
    items.sort((a, b) => a.product.title.localeCompare(b.product.title))
    return items
  }

  async updateProductVariant(
    sellerId: string,
    productId: string,
    variantId: string,
    patch: UpdateProductVariantInput,
  ): Promise<VendorProductDto | null> {
    const found = await this.wdb
      .select({ variantId: productVariants.id, offerId: offers.id })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .innerJoin(offers, eq(offers.variantId, productVariants.id))
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(products.id, productId),
          eq(products.sellerId, sellerId),
        ),
      )
      .limit(1)
    const row = found[0]
    if (!row) return null
    if (patch.pricePesewas !== undefined && patch.pricePesewas < 0n) {
      throw new CatalogValidationError("price must be >= 0")
    }
    if (patch.onHand !== undefined && (!Number.isInteger(patch.onHand) || patch.onHand < 0)) {
      throw new CatalogValidationError("stock must be a whole number >= 0")
    }
    const offerPatch: Partial<{ pricePesewas: bigint; onHand: number; active: boolean }> = {}
    if (patch.pricePesewas !== undefined) offerPatch.pricePesewas = patch.pricePesewas
    if (patch.onHand !== undefined) offerPatch.onHand = patch.onHand
    if (patch.active !== undefined) offerPatch.active = patch.active
    if (Object.keys(offerPatch).length > 0) {
      await this.wdb.update(offers).set(offerPatch).where(eq(offers.id, row.offerId))
    }
    invalidateSnapshot(this.wdb, this.db)
    return this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
  }

  async addProductOptionValue(
    sellerId: string,
    productId: string,
    input: AddOptionValueInput,
  ): Promise<VendorProductDto | null> {
    const clean = (v: string) => v.trim().replace(/\s+/g, " ")
    const data = await this.load(this.wdb)
    const product = data.products.find((p) => p.id === productId && p.sellerId === sellerId)
    if (!product) return null
    const value = clean(input.value)
    if (!value) throw new CatalogValidationError("value is required")
    if (value.length > MAX_OPTION_VALUE) {
      throw new CatalogValidationError("option value exceeds " + MAX_OPTION_VALUE + " characters")
    }
    const extras = assembleExtras(data, productId)
    const option = input.optionId
      ? extras.options.find((o) => o.id === input.optionId)
      : input.optionName
        ? extras.options.find((o) => o.name.toLowerCase() === clean(input.optionName as string).toLowerCase())
        : undefined
    if (!option && input.optionId) throw new CatalogValidationError("unknown option")
    if (!option && extras.options.length >= MAX_OPTION_TYPES) {
      throw new CatalogValidationError("at most " + MAX_OPTION_TYPES + " option types")
    }
    if (option && input.existingValue !== undefined) {
      throw new CatalogValidationError("existingValue only applies to brand-new option types")
    }
    let createdCombos = 0
    if (option) {
      if (option.values.some((v) => v.value.toLowerCase() === value.toLowerCase())) {
        return this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
      }
      const valueId = crypto.randomUUID()
      await this.wdb.insert(productOptionValues).values({
        id: valueId,
        optionId: option.id,
        value,
        position: option.values.length,
      })
      createdCombos = await this.createCombosForValues(productId, [{ optionId: option.id, valueId }])
    } else {
      const existingValue = input.existingValue !== undefined ? clean(input.existingValue) : ""
      if (!existingValue) {
        throw new CatalogValidationError("existingValue labels your current listing - required for a new option type")
      }
      const optionName = clean(input.optionName ?? "Option")
      if (!optionName) throw new CatalogValidationError("option name is required")
      const optionId = crypto.randomUUID()
      await this.wdb.insert(productOptions).values({
        id: optionId,
        productId,
        name: optionName,
        position: extras.options.length,
      })
      const distinct = [...new Set([existingValue, value])]
      const valueIds = new Map<string, string>()
      for (const entry of distinct.entries()) {
        const valueId = crypto.randomUUID()
        await this.wdb.insert(productOptionValues).values({ id: valueId, optionId, value: entry[1], position: entry[0] })
        valueIds.set(entry[1].toLowerCase(), valueId)
      }
      const labelId = valueIds.get(existingValue.toLowerCase()) as string
      const current = await this.load(this.wdb)
      for (const combo of assembleExtras(current, productId).variants) {
        const has = current.variantOptionValues.some(
          (l) => l.variantId === combo.variant.id && l.valueId === labelId,
        )
        if (!has) {
          await this.wdb
            .insert(variantOptionValues)
            .values({ id: crypto.randomUUID(), variantId: combo.variant.id, valueId: labelId })
        }
      }
      const extra = distinct.filter((v) => v.toLowerCase() !== existingValue.toLowerCase())
      if (extra.length > 0) {
        createdCombos = await this.createCombosForValues(
          productId,
          extra.map((v) => ({ optionId, valueId: valueIds.get(v.toLowerCase()) as string })),
        )
      }
    }
    if (createdCombos > 0 && product.status === "published") {
      await this.wdb.update(products).set({ status: "proposed" }).where(eq(products.id, productId))
    }
    invalidateSnapshot(this.wdb, this.db)
    return this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
  }

  /** Materialize new combos for fixed (optionId, valueId) pairs; new combos start unstocked. */
  private async createCombosForValues(
    productId: string,
    fixed: { optionId: string; valueId: string }[],
  ): Promise<number> {
    const data = await this.load(this.wdb)
    const extras = assembleExtras(data, productId)
    const product = data.products.find((p) => p.id === productId)
    if (!product || !product.sellerId) return 0
    const fixedOptionIds = new Set(fixed.map((f) => f.optionId))
    const others = extras.options.filter((o) => !fixedOptionIds.has(o.id))
    let base: Record<string, string>[] = [{}]
    for (const opt of others) {
      const next: Record<string, string>[] = []
      for (const combo of base) {
        for (const v of opt.values) next.push({ ...combo, [opt.name]: v.value })
      }
      base = next
    }
    const optNames = new Map(extras.options.map((o) => [o.id, o.name]))
    const fixedByOption = new Map<string, string[]>()
    for (const f of fixed) {
      const val = data.productOptionValues.find((v) => v.id === f.valueId)?.value ?? ""
      const arr = fixedByOption.get(f.optionId) ?? []
      arr.push(val)
      fixedByOption.set(f.optionId, arr)
    }
    let expanded: Record<string, string>[] = base
    for (const entry of fixedByOption) {
      const name = optNames.get(entry[0]) as string
      const next: Record<string, string>[] = []
      for (const c of expanded) for (const v of entry[1]) next.push({ ...c, [name]: v })
      expanded = next
    }
    const existingCount = data.variants.filter((v) => v.productId === productId).length
    let created = 0
    for (const full of expanded) {
      const variantId = crypto.randomUUID()
      const names = Object.keys(full)
      const sibling =
        extras.variants.find((c) =>
          names.every((k) => {
            const isFixed = [...fixedByOption].some(
              ([oid, vals]) =>
                optNames.get(oid)?.toLowerCase() === k.toLowerCase() &&
                vals.some((x) => x.toLowerCase() === (full[k] as string).toLowerCase()),
            )
            if (isFixed) return true
            return (c.options[k] ?? "").toLowerCase() === (full[k] as string).toLowerCase()
          }),
        ) ?? extras.variants[0]
      await this.wdb.insert(productVariants).values({
        id: variantId,
        productId,
        sku: comboSku(productId, existingCount + created),
        title: comboLabel(full, extras.options.map((o) => o.name)),
      })
      for (const entry of Object.entries(full)) {
        const opt = extras.options.find((o) => o.name.toLowerCase() === entry[0].toLowerCase())
        const valueId = data.productOptionValues.find(
          (r) => r.optionId === opt?.id && r.value.toLowerCase() === entry[1].toLowerCase(),
        )?.id
        if (valueId) {
          await this.wdb
            .insert(variantOptionValues)
            .values({ id: crypto.randomUUID(), variantId, valueId })
        }
      }
      await this.wdb.insert(offers).values({
        id: crypto.randomUUID(),
        sellerId: product.sellerId,
        productId,
        variantId,
        pricePesewas: sibling ? BigInt(sibling.offer.pricePesewas) : 0n,
        onHand: 0,
        reserved: 0,
        currency: "ghs",
        active: true,
      })
      created += 1
    }
    return created
  }

  async listAdminProducts(status?: ProductStatus): Promise<AdminProductDto[]> {
    const data = await this.load()
    return data.products
      .filter((p) => (status ? p.status === status : true))
      .map(toAdminProductDto)
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  async listAdminProductsWithFlags(status?: ProductStatus) {
    const data = await this.load()
    const ctx = flaggingContext(
      data.products.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        primaryCategoryId: p.primaryCategoryId,
        sellerId: p.sellerId,
      })),
      data.offers.map((o) => ({
        productId: o.productId,
        pricePesewas: toBigInt(o.pricePesewas),
        onHand: o.onHand,
        active: o.active,
      })),
    )
    return data.products
      .filter((p) => (status ? p.status === status : true))
      .map((p) => ({
        ...toAdminProductDto(p),
        flags: flagCatalogProduct(
          {
            id: p.id,
            title: p.title,
            description: p.description,
            imageUrl: p.imageUrl,
            primaryCategoryId: p.primaryCategoryId,
            sellerId: p.sellerId,
          },
          ctx,
        ),
      }))
      .sort((a, b) => b.flags.length - a.flags.length || a.title.localeCompare(b.title))
  }

  async moderateProduct(
    productId: string,
    action: AdminProductModerationAction,
  ): Promise<AdminProductDto | null> {
    // Status transition must read current state via primary (stale status -> wrong transition).
    const data = await this.load(this.wdb)
    const product = data.products.find((p) => p.id === productId)
    if (!product) return null
    const next = nextModerationStatus(product.status, action)
    await this.wdb.update(products).set({ status: next }).where(eq(products.id, productId))
    invalidateSnapshot(this.wdb, this.db)
    return { ...toAdminProductDto(product), status: next }
  }

  async getAdminProductDetail(productId: string): Promise<VendorProductDto | null> {
    const data = await this.load(this.wdb)
    const product = data.products.find((p) => p.id === productId)
    if (!product || !product.sellerId) return null
    return this.loadOwnedVendorProduct(product.sellerId, productId, this.wdb)
  }

  // ── Phase 1A: taxonomy lifecycle (Postgres) ──

  async listTaxonomyNodes(): Promise<TaxonomyNodeDto[]> {
    const data = await this.load()
    return data.categories
      .map(toTaxonomyNodeDto)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.handle.localeCompare(b.handle))
  }

  async createTaxonomyNode(input: CreateTaxonomyNodeInput): Promise<TaxonomyNodeDto> {
    const data = await this.load(this.wdb)
    const code = input.code.trim()
    const name = input.name.trim()
    if (!code) throw new CatalogValidationError("code required")
    if (!name) throw new CatalogValidationError("name required")
    if (data.categories.some((c) => c.code === code)) {
      throw new CatalogConflictError("category code already exists")
    }
    const slug = cleanText(input.slug) ?? slugify(code)
    const handle = cleanText(input.handle) ?? slug
    if (data.categories.some((c) => c.handle === handle || c.slug === slug)) {
      throw new CatalogConflictError("category slug/handle already exists")
    }
    const parentId = input.parentId ?? null
    if (parentId !== null && !data.categories.some((c) => c.id === parentId)) {
      throw new CatalogValidationError("unknown parent category")
    }
    const level = taxonomyLevel(data.categories, parentId)
    const id = crypto.randomUUID()
    const browseable = input.isBrowseable ?? true
    const assignable = input.isAssignable ?? true
    const navVisible = input.isNavVisible ?? true
    const sortOrder = input.sortOrder ?? 0
    await this.wdb.insert(categories).values({
      id,
      handle,
      name,
      parentId,
      rank: sortOrder,
      isNav: navVisible,
      code,
      displayName: cleanText(input.displayName),
      slug,
      level,
      status: "proposed",
      isBrowseable: browseable,
      isAssignable: assignable,
      isNavVisible: navVisible,
      attributeProfileId: cleanText(input.attributeProfileId),
      replacementNodeId: null,
      sortOrder,
      version: 1,
    })
    invalidateSnapshot(this.wdb, this.db)
    return {
      id,
      code,
      canonicalName: name,
      displayName: cleanText(input.displayName),
      slug,
      handle,
      parentId,
      level,
      status: "proposed",
      isBrowseable: browseable,
      isAssignable: assignable,
      isNavVisible: navVisible,
      attributeProfileId: cleanText(input.attributeProfileId),
      replacementNodeId: null,
      sortOrder,
      version: 1,
    }
  }

  async updateTaxonomyNode(
    id: string,
    patch: UpdateTaxonomyNodeInput,
  ): Promise<TaxonomyNodeDto | null> {
    const data = await this.load(this.wdb)
    const row = data.categories.find((c) => c.id === id)
    if (!row) return null
    if (taxonomyStatusOf(row) === "deprecated") {
      throw new CatalogValidationError("deprecated categories are read-only; create a successor instead")
    }
    const set: Record<string, unknown> = {}
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new CatalogValidationError("name required")
      set["name"] = patch.name.trim()
    }
    if (patch.displayName !== undefined) set["displayName"] = cleanText(patch.displayName)
    if (patch.slug !== undefined) {
      const slug = cleanText(patch.slug) ?? slugify(row.code ?? row.handle)
      if (data.categories.some((c) => c.id !== id && (c.slug === slug || c.handle === slug))) {
        throw new CatalogConflictError("category slug/handle already exists")
      }
      set["slug"] = slug
    }
    if (patch.parentId !== undefined) {
      if (patch.parentId !== null && !data.categories.some((c) => c.id === patch.parentId)) {
        throw new CatalogValidationError("unknown parent category")
      }
      if (patch.parentId === id) throw new CatalogValidationError("a category cannot parent itself")
      set["parentId"] = patch.parentId
      set["level"] = taxonomyLevel(data.categories, patch.parentId)
    }
    if (patch.isBrowseable !== undefined) set["isBrowseable"] = patch.isBrowseable
    if (patch.isAssignable !== undefined) set["isAssignable"] = patch.isAssignable
    if (patch.isNavVisible !== undefined) {
      set["isNavVisible"] = patch.isNavVisible
      set["isNav"] = patch.isNavVisible
    }
    if (patch.attributeProfileId !== undefined) {
      set["attributeProfileId"] = cleanText(patch.attributeProfileId)
    }
    if (patch.sortOrder !== undefined) {
      set["sortOrder"] = patch.sortOrder
      set["rank"] = patch.sortOrder
    }
    if (patch.status !== undefined) {
      activateCategory({ id, status: taxonomyStatusOf(row) })
      set["status"] = "active"
    }
    set["version"] = (row.version ?? 1) + 1
    await this.wdb.update(categories).set(set).where(eq(categories.id, id))
    invalidateSnapshot(this.wdb, this.db)
    const fresh = await this.load(this.wdb)
    const updated = fresh.categories.find((c) => c.id === id)!
    return toTaxonomyNodeDto(updated)
  }

  async deprecateTaxonomyNode(id: string, replacementId: string): Promise<TaxonomyNodeDto | null> {
    const data = await this.load(this.wdb)
    const row = data.categories.find((c) => c.id === id)
    if (!row) return null
    const replacement = data.categories.find((c) => c.id === replacementId) ?? null
    deprecateCategory(
      { id: row.id, status: taxonomyStatusOf(row) },
      replacement
        ? { id: replacement.id, status: taxonomyStatusOf(replacement) }
        : null,
    )
    await this.wdb
      .update(categories)
      .set({
        status: "deprecated",
        replacementNodeId: replacementId,
        isNavVisible: false,
        isNav: false,
        version: (row.version ?? 1) + 1,
      })
      .where(eq(categories.id, id))
    invalidateSnapshot(this.wdb, this.db)
    const fresh = await this.load(this.wdb)
    return toTaxonomyNodeDto(fresh.categories.find((c) => c.id === id)!)
  }

  async resolveCategoryRedirect(
    slugOrId: string,
  ): Promise<{ id: string; slug: string | null } | null> {
    const data = await this.load()
    return resolveRedirectFromRows(data.categories, slugOrId)
  }

  // ── Phase 1B: product identity (Postgres) ──

  async updateProductIdentity(
    productId: string,
    patch: UpdateProductIdentityInput,
    scope: { sellerId: string } | { admin: true },
  ): Promise<ProductIdentityDto | null> {
    const data = await this.load(this.wdb)
    const product = data.products.find((p) => p.id === productId)
    if (!product) return null
    if (!("admin" in scope)) {
      if (!sellerOwnsProduct(data, scope.sellerId, productId)) return null
    }
    const set: Record<string, unknown> = {}
    if (patch.brand !== undefined) set["brand"] = cleanText(patch.brand)
    if (patch.model !== undefined) set["model"] = cleanText(patch.model)
    if (patch.gtin !== undefined) set["gtin"] = cleanText(patch.gtin)
    if (patch.mpn !== undefined) set["mpn"] = cleanText(patch.mpn)
    if (patch.manufacturer !== undefined) set["manufacturer"] = cleanText(patch.manufacturer)
    if (patch.productType !== undefined) set["productType"] = cleanText(patch.productType)
    if (Object.keys(set).length > 0) {
      await this.wdb.update(products).set(set).where(eq(products.id, productId))
      invalidateSnapshot(this.wdb, this.db)
    }
    const fresh = await this.load(this.wdb)
    return identityOfProduct(fresh.products.find((p) => p.id === productId)!)
  }

  async promoteProductIdentity(
    productId: string,
    confidence: IdentityConfidence,
    reviewerId: string,
  ): Promise<ProductIdentityDto | null> {
    const data = await this.load(this.wdb)
    const product = data.products.find((p) => p.id === productId)
    if (!product) return null
    const next = promoteIdentityConfidence(
      product.identityConfidence ?? "seller_specific",
      confidence,
      reviewerId,
    )
    const provenance = {
      ...((product.identityProvenance as Record<string, unknown> | null) ?? {}),
      promotedBy: reviewerId,
      promotedAt: new Date().toISOString(),
      confidence: next,
    }
    await this.wdb
      .update(products)
      .set({ identityConfidence: next, identityProvenance: provenance })
      .where(eq(products.id, productId))
    invalidateSnapshot(this.wdb, this.db)
    const fresh = await this.load(this.wdb)
    return identityOfProduct(fresh.products.find((p) => p.id === productId)!)
  }

  // ── Phase 1C: typed attributes (Postgres) ──

  async listAttributeDefinitions(): Promise<AttributeDefinitionDto[]> {
    const data = await this.load()
    ensurePhase1Arrays(data)
    return data.attributeDefinitions.map(definitionDto)
  }

  async createAttributeDefinition(
    input: CreateAttributeDefinitionInput,
  ): Promise<AttributeDefinitionDto> {
    const data = await this.load(this.wdb)
    ensurePhase1Arrays(data)
    const code = input.code.trim()
    if (!code) throw new CatalogValidationError("code required")
    if (!input.label.trim()) throw new CatalogValidationError("label required")
    if (
      data.attributeDefinitions.some((d) => d.code.toLowerCase() === code.toLowerCase())
    ) {
      throw new CatalogConflictError("attribute code already exists")
    }
    if (
      (input.type === "option" || input.type === "multi_option") &&
      (!input.allowedValues || input.allowedValues.length === 0)
    ) {
      throw new CatalogValidationError("option attributes require allowed values")
    }
    const id = crypto.randomUUID()
    const row = {
      id,
      code,
      label: input.label.trim(),
      type: input.type,
      unitFamily: cleanText(input.unitFamily),
      allowedValues: input.allowedValues?.map((v) => v.trim()).filter(Boolean) ?? null,
      filterable: input.filterable ?? false,
      searchable: input.searchable ?? false,
      required: input.required ?? false,
      variantAxis: input.variantAxis ?? false,
      visibleOnCard: input.visibleOnCard ?? false,
      visibleOnPdp: input.visibleOnPdp ?? true,
    }
    await this.wdb.insert(attributeDefinitions).values(row)
    invalidateSnapshot(this.wdb, this.db)
    return definitionDto({ ...row, allowedValues: row.allowedValues ?? null })
  }

  async listAttributeProfiles(): Promise<AttributeProfileDto[]> {
    const data = await this.load()
    ensurePhase1Arrays(data)
    return data.attributeProfiles.map((p) => profileDto(data, p))
  }

  async createAttributeProfile(input: {
    name: string
    categoryId?: string | null
    definitions: Array<{ definitionId: string; position?: number; required?: boolean }>
  }): Promise<AttributeProfileDto> {
    const data = await this.load(this.wdb)
    ensurePhase1Arrays(data)
    if (!input.name.trim()) throw new CatalogValidationError("name required")
    if (input.categoryId !== undefined && input.categoryId !== null) {
      if (!data.categories.some((c) => c.id === input.categoryId)) {
        throw new CatalogValidationError("unknown category")
      }
    }
    for (const link of input.definitions) {
      if (!data.attributeDefinitions.some((d) => d.id === link.definitionId)) {
        throw new CatalogValidationError(`unknown attribute definition ${link.definitionId}`)
      }
    }
    const id = crypto.randomUUID()
    await this.wdb.insert(attributeProfiles).values({
      id,
      name: input.name.trim(),
      categoryId: input.categoryId ?? null,
      version: 1,
    })
    for (const [i, link] of input.definitions.entries()) {
      await this.wdb.insert(profileAttributes).values({
        id: crypto.randomUUID(),
        profileId: id,
        definitionId: link.definitionId,
        position: link.position ?? i,
        required: link.required ?? false,
      })
    }
    invalidateSnapshot(this.wdb, this.db)
    const fresh = await this.load(this.wdb)
    return profileDto(
      fresh,
      fresh.attributeProfiles.find((p) => p.id === id)!,
    )
  }

  async listProductAttributeValues(productId: string): Promise<ProductAttributeValueDto[]> {
    const data = await this.load()
    ensurePhase1Arrays(data)
    return data.productAttributeValues
      .filter((v) => v.productId === productId)
      .map((v) => productAttributeValueDto(data, v))
  }

  async setProductAttributeValues(
    productId: string,
    values: SetProductAttributeValueInput[],
    scope: { sellerId: string } | { admin: true },
  ): Promise<ProductAttributeValueDto[]> {
    const data = await this.load(this.wdb)
    ensurePhase1Arrays(data)
    const product = data.products.find((p) => p.id === productId)
    if (!product) throw new CatalogValidationError("unknown product")
    if (!("admin" in scope)) {
      if (!sellerOwnsProduct(data, scope.sellerId, productId)) {
        throw new CatalogValidationError("not your product")
      }
    }
    const defById = new Map(data.attributeDefinitions.map((d) => [d.id, d]))
    for (const v of values) {
      const def = defById.get(v.definitionId)
      if (!def) throw new CatalogValidationError(`unknown attribute definition ${v.definitionId}`)
      validateAttributeValue(
        {
          id: def.id,
          code: def.code,
          type: def.type,
          allowedValues: def.allowedValues,
          required: def.required,
        },
        {
          textValue: v.textValue ?? null,
          numberValue: v.numberValue ?? null,
          booleanValue: v.booleanValue ?? null,
          optionValues: v.optionValues ?? null,
          unit: v.unit ?? null,
        },
      )
    }
    for (const v of values) {
      const row = {
        textValue: v.textValue ?? null,
        numberValue: v.numberValue ?? null,
        booleanValue: v.booleanValue ?? null,
        optionValues: v.optionValues ?? null,
        unit: cleanText(v.unit),
      }
      await this.wdb
        .insert(productAttributeValues)
        .values({ id: crypto.randomUUID(), productId, definitionId: v.definitionId, ...row })
        .onConflictDoUpdate({
          target: [productAttributeValues.productId, productAttributeValues.definitionId],
          set: row,
        })
    }
    invalidateSnapshot(this.wdb, this.db)
    const fresh = await this.load(this.wdb)
    return fresh.productAttributeValues
      .filter((v) => v.productId === productId)
      .map((v) => productAttributeValueDto(fresh, v))
  }

  // ── Phase 1D: match candidates (Postgres) ──

  async proposeMatchCandidate(
    productId: string,
    candidateProductId: string,
    source: string,
    evidence?: Record<string, unknown> | null,
  ): Promise<MatchCandidateDto> {
    const data = await this.load(this.wdb)
    ensurePhase1Arrays(data)
    if (productId === candidateProductId) {
      throw new CatalogValidationError("a product cannot match itself")
    }
    if (
      !data.products.some((p) => p.id === productId) ||
      !data.products.some((p) => p.id === candidateProductId)
    ) {
      throw new CatalogValidationError("unknown product")
    }
    const dupe = data.matchCandidates.find(
      (m) =>
        m.status === "proposed" &&
        ((m.productId === productId && m.candidateProductId === candidateProductId) ||
          (m.productId === candidateProductId && m.candidateProductId === productId)),
    )
    if (dupe) throw new CatalogConflictError("match already proposed")
    const id = crypto.randomUUID()
    const now = new Date()
    await this.wdb.insert(productMatchCandidates).values({
      id,
      productId,
      candidateProductId,
      source,
      evidence: evidence ?? null,
      status: "proposed",
      reviewerId: null,
      reviewedAt: null,
      createdAt: now,
    })
    invalidateSnapshot(this.wdb, this.db)
    return {
      id,
      productId,
      candidateProductId,
      source,
      evidence: evidence ?? null,
      status: "proposed",
      reviewerId: null,
      reviewedAt: null,
      createdAt: now.toISOString(),
    }
  }

  async listMatchCandidates(
    status?: "proposed" | "confirmed" | "rejected",
  ): Promise<MatchCandidateDto[]> {
    const data = await this.load()
    ensurePhase1Arrays(data)
    return data.matchCandidates
      .filter((m) => !status || m.status === status)
      .map(toMatchCandidateDto)
  }

  async reviewMatchCandidate(
    id: string,
    decision: "confirmed" | "rejected",
    reviewerId: string,
  ): Promise<MatchCandidateDto | null> {
    const data = await this.load(this.wdb)
    ensurePhase1Arrays(data)
    const row = data.matchCandidates.find((m) => m.id === id)
    if (!row) return null
    if (row.status !== "proposed") {
      throw new CatalogValidationError("only proposed matches can be reviewed")
    }
    if (!reviewerId.trim()) throw new CatalogValidationError("reviewer required")
    const reviewedAt = new Date()
    await this.wdb
      .update(productMatchCandidates)
      .set({ status: decision, reviewerId, reviewedAt })
      .where(eq(productMatchCandidates.id, id))
    if (decision === "confirmed") {
      for (const pid of [row.productId, row.candidateProductId]) {
        const product = data.products.find((p) => p.id === pid)
        if (product && (product.identityConfidence ?? "seller_specific") === "seller_specific") {
          await this.wdb
            .update(products)
            .set({
              identityConfidence: "matched",
              identityProvenance: {
                ...((product.identityProvenance as Record<string, unknown> | null) ?? {}),
                matchedBy: reviewerId,
                matchedAt: reviewedAt.toISOString(),
                matchCandidateId: id,
              },
            })
            .where(eq(products.id, pid))
        }
      }
    }
    invalidateSnapshot(this.wdb, this.db)
    const fresh = await this.load(this.wdb)
    const updated = fresh.matchCandidates.find((m) => m.id === id)!
    return toMatchCandidateDto(updated)
  }
}
