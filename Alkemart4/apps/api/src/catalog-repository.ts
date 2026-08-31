import {
  categories,
  offers,
  products,
  productVariants,
  sellers,
} from "@alkemart/db"
import {
  buildNavTree,
  isSellable,
  toProductCard,
  toProductDetail,
  type CategoryNode,
  type PeerOfferInput,
  type ProductCardDto,
  type ProductDetailDto,
} from "@alkemart/domain"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type {
  CatalogOffer,
  CatalogProduct,
  CatalogSnapshot,
} from "./demo-seed"

export type CatalogListQuery = {
  category?: string
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

export interface CatalogRepository {
  listCategories(): Promise<CategoryNode[]>
  listCatalog(query: CatalogListQuery): Promise<CatalogListDto>
  getProduct(id: string): Promise<ProductDetailDto | null>
  getSellerShop(handle: string): Promise<SellerShopDto | null>
}

function toBigInt(value: bigint | string | number): bigint {
  return typeof value === "bigint" ? value : BigInt(value)
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

export class InMemoryCatalogRepository implements CatalogRepository {
  constructor(private readonly data: CatalogSnapshot) {}

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
}

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  private async load(): Promise<CatalogSnapshot> {
    const [categoryRows, sellerRows, productRows, variantRows, offerRows] = await Promise.all([
      this.db.select().from(categories),
      this.db.select().from(sellers),
      this.db.select().from(products),
      this.db.select().from(productVariants),
      this.db.select().from(offers),
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
}
