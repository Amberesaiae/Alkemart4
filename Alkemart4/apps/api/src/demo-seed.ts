import { GHANA_CATEGORY_SEED, type CategorySeedRow } from "@alkemart/db"
import type { ProductStatus, SellerStatus } from "@alkemart/domain"

export type CatalogCategory = CategorySeedRow

export type CatalogSeller = {
  id: string
  handle: string
  name: string
  status: SellerStatus
  commissionBps: number
  deliveryFeePesewas: bigint
}

export type CatalogProduct = {
  id: string
  title: string
  description: string | null
  status: ProductStatus
  primaryCategoryId: string
  sellerId: string | null
  imageUrl?: string | null
  /** ISO string in snapshots; Date in Postgres rows. */
  createdAt?: string | null
}

export type CatalogVariant = {
  id: string
  productId: string
  sku: string | null
  title: string | null
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
}

export type CatalogSnapshot = {
  categories: CatalogCategory[]
  sellers: CatalogSeller[]
  products: CatalogProduct[]
  variants: CatalogVariant[]
  offers: CatalogOffer[]
}

export type JsonCatalogSnapshot = {
  categories: CatalogCategory[]
  sellers: Array<Omit<CatalogSeller, "deliveryFeePesewas"> & { deliveryFeePesewas: string }>
  products: CatalogProduct[]
  variants: CatalogVariant[]
  offers: Array<Omit<CatalogOffer, "pricePesewas"> & { pricePesewas: string }>
}

/** 1 product, 2 sellers, 2 offers (seller-a cheaper). */
export function demoCatalog(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [
      {
        id: "seller-a",
        handle: "seller-a",
        name: "Accra Mart",
        status: "open",
        commissionBps: 700,
        deliveryFeePesewas: 500n,
      },
      {
        id: "seller-b",
        handle: "seller-b",
        name: "Kumasi Tech",
        status: "open",
        commissionBps: 700,
        deliveryFeePesewas: 800n,
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
        currency: "ghs",
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
        currency: "ghs",
        active: true,
      },
    ],
  }
}

export function snapshotToJson(data: CatalogSnapshot): JsonCatalogSnapshot {
  return {
    categories: data.categories,
    sellers: data.sellers.map((s) => ({
      ...s,
      deliveryFeePesewas: s.deliveryFeePesewas.toString(),
    })),
    products: data.products,
    variants: data.variants,
    offers: data.offers.map((o) => ({
      ...o,
      pricePesewas: o.pricePesewas.toString(),
    })),
  }
}

export function snapshotFromJson(json: JsonCatalogSnapshot): CatalogSnapshot {
  return {
    categories: json.categories,
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
    })),
  }
}
