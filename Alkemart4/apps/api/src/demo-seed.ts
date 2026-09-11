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
  availability: "open" | "paused"
  pausedUntil: string | null
  pauseNote: string | null
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
}

export type JsonCatalogSnapshot = {
  categories: CatalogCategory[]
  productOptions?: CatalogProductOption[]
  productOptionValues?: CatalogProductOptionValue[]
  variantOptionValues?: CatalogVariantOptionValue[]
  sellers: Array<Omit<CatalogSeller, "deliveryFeePesewas"> & { deliveryFeePesewas: string }>
  products: CatalogProduct[]
  variants: CatalogVariant[]
  offers: Array<Omit<CatalogOffer, "pricePesewas"> & { pricePesewas: string }>
}

/** 1 product, 2 sellers, 2 offers (seller-a cheaper). */
export function demoCatalog(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
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
    productOptions: data.productOptions,
    productOptionValues: data.productOptionValues,
    variantOptionValues: data.variantOptionValues,
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
    productOptions: json.productOptions ?? [],
    productOptionValues: json.productOptionValues ?? [],
    variantOptionValues: json.variantOptionValues ?? [],
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
