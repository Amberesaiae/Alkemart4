import {
  categories,
  offers,
  products,
  productVariants,
  sellers,
} from "@alkemart/db"
import {
  approveProduct,
  assertLeafCategory,
  buildNavTree,
  isSellable,
  proposeProduct,
  rejectProduct,
  requestProductChanges,
  toProductCard,
  toProductDetail,
  type CategoryNode,
  type PeerOfferInput,
  type ProductCardDto,
  type ProductDetailDto,
  type ProductStatus,
} from "@alkemart/domain"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  CatalogOffer,
  CatalogProduct,
  CatalogSnapshot,
  CatalogVariant,
} from "./demo-seed"

export type CatalogListQuery = {
  category?: string
  /** Case-insensitive title substring filter (Workers search). */
  q?: string
  limit: number
  offset: number
}

export type CatalogListDto = {
  items: ProductCardDto[]
  total: number
}

export type SellerShopDto = {
  seller: { id: string; handle: string; name: string }
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

export type VendorProductDto = {
  product: {
    id: string
    title: string
    description: string | null
    status: ProductStatus
    primaryCategoryId: string
    sellerId: string | null
  }
  variant: {
    id: string
    sku: string | null
    title: string | null
  }
  offer: VendorOfferDto
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
}

export type AdminProductDto = {
  id: string
  title: string
  description: string | null
  status: ProductStatus
  primaryCategoryId: string
  sellerId: string | null
}

export type AdminProductModerationAction = "approve" | "reject" | "request_changes"

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

export interface CatalogRepository {
  listCategories(): Promise<CategoryNode[]>
  listCatalog(query: CatalogListQuery): Promise<CatalogListDto>
  getProduct(id: string): Promise<ProductDetailDto | null>
  getSellerShop(handle: string): Promise<SellerShopDto | null>
  listOpenSellers(): Promise<Array<{ id: string; handle: string; name: string }>>
  createVendorProduct(input: CreateVendorProductInput): Promise<VendorProductDto>
  updateVendorProduct(
    sellerId: string,
    productId: string,
    patch: UpdateVendorProductInput,
  ): Promise<VendorProductDto | null>
  proposeVendorProduct(sellerId: string, productId: string): Promise<VendorProductDto | null>
  listVendorProducts(sellerId: string): Promise<VendorProductDto[]>
  listAdminProducts(status?: ProductStatus): Promise<AdminProductDto[]>
  moderateProduct(
    productId: string,
    action: AdminProductModerationAction,
  ): Promise<AdminProductDto | null>
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
  const tree = buildNavTree(categoryRows.filter((c) => c.isNav))
  const node = findCategoryNode(tree, categoryId)
  if (!node) throw new CatalogValidationError("unknown category")
  try {
    assertLeafCategory(node)
  } catch {
    throw new CatalogValidationError("category must be a leaf")
  }
}

function toVendorProductDto(
  product: CatalogProduct,
  variant: CatalogVariant,
  offer: CatalogOffer,
): VendorProductDto {
  return {
    product: {
      id: product.id,
      title: product.title,
      description: product.description,
      status: product.status,
      primaryCategoryId: product.primaryCategoryId,
      sellerId: product.sellerId,
    },
    variant: {
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
    },
    offer: {
      id: offer.id,
      sellerId: offer.sellerId,
      productId: offer.productId,
      variantId: offer.variantId,
      pricePesewas: offer.pricePesewas.toString(),
      onHand: offer.onHand,
      reserved: offer.reserved,
      currency: "ghs",
      active: offer.active,
    },
  }
}

function toAdminProductDto(product: CatalogProduct): AdminProductDto {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    status: product.status,
    primaryCategoryId: product.primaryCategoryId,
    sellerId: product.sellerId,
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
    imageUrl: null as string | null,
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
  const cards = cardsFor(productRows, data, sellablePeerOffers(data))
  return {
    items: cards.slice(query.offset, query.offset + query.limit),
    total: cards.length,
  }
}

export function getProductFrom(data: CatalogSnapshot, id: string): ProductDetailDto | null {
  const product = data.products.find((p) => p.id === id)
  if (!product) return null
  const cat = categoryById(data).get(product.primaryCategoryId)
  const offersForProduct = sellablePeerOffers(data).get(product.id) ?? []
  return toProductDetail(
    {
      productId: product.id,
      title: product.title,
      description: product.description,
      categoryHandle: cat?.handle ?? product.primaryCategoryId,
      categoryName: cat?.name ?? product.primaryCategoryId,
      imageUrls: [],
    },
    offersForProduct,
  )
}

export function getSellerShopFrom(data: CatalogSnapshot, handle: string): SellerShopDto | null {
  const seller = data.sellers.find((s) => s.handle === handle)
  if (!seller) return null
  const offersForSeller = sellablePeerOffers(data, (o) => o.sellerId === seller.id)
  const productIds = new Set(offersForSeller.keys())
  return {
    seller: { id: seller.id, handle: seller.handle, name: seller.name },
    items: cardsFor(
      data.products.filter((p) => productIds.has(p.id)),
      data,
      offersForSeller,
    ),
  }
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

  async getProduct(id: string) {
    return getProductFrom(this.data, id)
  }

  async getSellerShop(handle: string) {
    return getSellerShopFrom(this.data, handle)
  }

  async listOpenSellers() {
    return listOpenSellersFrom(this.data)
  }

  async createVendorProduct(input: CreateVendorProductInput): Promise<VendorProductDto> {
    assertLeafCategoryId(this.data.categories, input.primaryCategoryId)
    const productId = crypto.randomUUID()
    const variantId = crypto.randomUUID()
    const offerId = crypto.randomUUID()
    const product: CatalogProduct = {
      id: productId,
      title: input.title,
      description: input.description,
      status: "proposed",
      primaryCategoryId: input.primaryCategoryId,
      sellerId: input.sellerId,
    }
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
    this.data.products.push(product)
    this.data.variants.push(variant)
    this.data.offers.push(offer)
    return toVendorProductDto(product, variant, offer)
  }

  async updateVendorProduct(
    sellerId: string,
    productId: string,
    patch: UpdateVendorProductInput,
  ): Promise<VendorProductDto | null> {
    const owned = sellerOwnsProduct(this.data, sellerId, productId)
    if (!owned) return null
    if (patch.primaryCategoryId !== undefined) {
      assertLeafCategoryId(this.data.categories, patch.primaryCategoryId)
      owned.product.primaryCategoryId = patch.primaryCategoryId
    }
    if (patch.title !== undefined) owned.product.title = patch.title
    if (patch.description !== undefined) owned.product.description = patch.description
    if (patch.sku !== undefined) owned.variant.sku = patch.sku
    if (patch.variantTitle !== undefined) owned.variant.title = patch.variantTitle
    if (patch.pricePesewas !== undefined) owned.offer.pricePesewas = patch.pricePesewas
    if (patch.onHand !== undefined) owned.offer.onHand = patch.onHand
    if (patch.active !== undefined) owned.offer.active = patch.active
    return toVendorProductDto(owned.product, owned.variant, owned.offer)
  }

  async proposeVendorProduct(
    sellerId: string,
    productId: string,
  ): Promise<VendorProductDto | null> {
    const owned = sellerOwnsProduct(this.data, sellerId, productId)
    if (!owned) return null
    owned.product.status = proposeProduct(owned.product.status)
    return toVendorProductDto(owned.product, owned.variant, owned.offer)
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
   * `db` is the (possibly cached) catalog read binding; `writeDb` is the primary
   * binding used for mutations and their read-after-write reads. Hyperdrive query
   * caching on the catalog binding can serve a pre-write snapshot, which previously
   * made createVendorProduct's read-back observe stale rows (live 500s).
   * See ACID-DATAFLOW.md: money/stock/RYW ops must use HYPERDRIVE_PRIMARY.
   */
  constructor(
    private readonly db: PostgresJsDatabase,
    private readonly writeDb?: PostgresJsDatabase,
  ) {}

  private get wdb(): PostgresJsDatabase {
    return this.writeDb ?? this.db
  }

  private async load(db: PostgresJsDatabase = this.db): Promise<CatalogSnapshot> {
    const [categoryRows, sellerRows, productRows, variantRows, offerRows] = await Promise.all([
      db.select().from(categories),
      db.select().from(sellers),
      db.select().from(products),
      db.select().from(productVariants),
      db.select().from(offers),
    ])
    return {
      categories: categoryRows.map((r) => ({
        id: r.id,
        handle: r.handle,
        name: r.name,
        parentId: r.parentId,
        rank: r.rank,
        isNav: r.isNav,
      })),
      sellers: sellerRows.map((r) => ({
        id: r.id,
        handle: r.handle,
        name: r.name,
        status: r.status,
        commissionBps: r.commissionBps,
        deliveryFeePesewas: toBigInt(r.deliveryFeePesewas),
      })),
      products: productRows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        primaryCategoryId: r.primaryCategoryId,
        sellerId: r.sellerId,
      })),
      variants: variantRows.map((r) => ({
        id: r.id,
        productId: r.productId,
        sku: r.sku,
        title: r.title,
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
      })),
    }
  }

  async listCategories() {
    return listCategoriesFrom(await this.load())
  }

  async listCatalog(query: CatalogListQuery) {
    return listCatalogFrom(await this.load(), query)
  }

  async getProduct(id: string) {
    return getProductFrom(await this.load(), id)
  }

  async getSellerShop(handle: string) {
    return getSellerShopFrom(await this.load(), handle)
  }

  async listOpenSellers() {
    return listOpenSellersFrom(await this.load())
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
    return owned ? toVendorProductDto(owned.product, owned.variant, owned.offer) : null
  }

  async createVendorProduct(input: CreateVendorProductInput): Promise<VendorProductDto> {
    await this.requireLeafCategory(input.primaryCategoryId)
    const productId = crypto.randomUUID()
    const variantId = crypto.randomUUID()
    const offerId = crypto.randomUUID()
    try {
      await this.wdb.transaction(async (tx) => {
        await tx.insert(products).values({
          id: productId,
          title: input.title,
          description: input.description,
          status: "proposed",
          primaryCategoryId: input.primaryCategoryId,
          sellerId: input.sellerId,
        })
        await tx.insert(productVariants).values({
          id: variantId,
          productId,
          sku: input.sku ?? null,
          title: input.variantTitle ?? "Default",
        })
        await tx.insert(offers).values({
          id: offerId,
          sellerId: input.sellerId,
          productId,
          variantId,
          pricePesewas: input.pricePesewas,
          onHand: input.onHand,
          reserved: 0,
          currency: "ghs",
          active: true,
        })
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("offers_seller_product_variant_uidx") || message.includes("23505")) {
        throw new CatalogConflictError()
      }
      throw err
    }
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
    if (patch.primaryCategoryId !== undefined) {
      await this.requireLeafCategory(patch.primaryCategoryId)
    }
    await this.wdb.transaction(async (tx) => {
      const productPatch: Partial<{
        title: string
        description: string | null
        primaryCategoryId: string
      }> = {}
      if (patch.title !== undefined) productPatch.title = patch.title
      if (patch.description !== undefined) productPatch.description = patch.description
      if (patch.primaryCategoryId !== undefined) {
        productPatch.primaryCategoryId = patch.primaryCategoryId
      }
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
    })
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
    return this.loadOwnedVendorProduct(sellerId, productId, this.wdb)
  }

  async listVendorProducts(sellerId: string): Promise<VendorProductDto[]> {
    const data = await this.load()
    const items: VendorProductDto[] = []
    for (const offer of data.offers) {
      if (offer.sellerId !== sellerId) continue
      const product = data.products.find((p) => p.id === offer.productId)
      const variant = data.variants.find((v) => v.id === offer.variantId)
      if (!product || !variant) continue
      items.push(toVendorProductDto(product, variant, offer))
    }
    items.sort((a, b) => a.product.title.localeCompare(b.product.title))
    return items
  }

  async listAdminProducts(status?: ProductStatus): Promise<AdminProductDto[]> {
    const data = await this.load()
    return data.products
      .filter((p) => (status ? p.status === status : true))
      .map(toAdminProductDto)
      .sort((a, b) => a.title.localeCompare(b.title))
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
    return { ...toAdminProductDto(product), status: next }
  }
}
