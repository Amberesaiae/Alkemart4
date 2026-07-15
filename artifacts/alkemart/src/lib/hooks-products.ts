import { useQuery, type UseQueryOptions } from "@tanstack/react-query"
import { useMedusa } from "./medusa-provider"
import { commerceContext } from "./medusa/client"
import type { CommerceProduct, ProductId, VariantId } from "./commerce/types"

export type MedusaProduct = {
  id: string
  title: string
  description?: string
  handle?: string
  subtitle?: string
  thumbnail?: string
  images?: { id: string; url: string }[]
  variants?: {
    id: string
    title: string
    prices?: { amount: number; currency_code: string }[]
    calculated_price?: {
      calculated_amount?: number | null
      original_amount?: number | null
    } | null
    options?: { id: string; option_id: string; value: string }[]
    inventory_quantity?: number | null
    manage_inventory?: boolean
    sku?: string | null
  }[]
  options?: { id: string; title: string; values: { id: string; value: string }[] }[]
  collection?: { id: string; title: string; handle: string }
  categories?: { id: string; name: string; handle: string }[]
  tags?: { id: string; name: string }[]
  /** Seller metadata when a marketplace link is present — never invent defaults. */
  metadata?: Record<string, unknown> | null
}

/** UI-facing product shape (aligned with CommerceProduct). */
export type AlkemartProduct = CommerceProduct

export type AlkemartProductListItem = Omit<
  AlkemartProduct,
  "description" | "stock" | "sku"
>

const PRODUCT_TAGS = new Set(["rollback", "clearance", "best", "popular", "new"])

type MedusaVariant = NonNullable<MedusaProduct["variants"]>[number]

function extractPricePesewas(variant: MedusaVariant | undefined): {
  pricePesewas: number
  isPriceAvailable: boolean
  compareAtPesewas?: number
} {
  const calculated = variant?.calculated_price?.calculated_amount
  const list = variant?.prices?.[0]?.amount
  const amount =
    typeof calculated === "number" && Number.isFinite(calculated)
      ? calculated
      : typeof list === "number" && Number.isFinite(list)
        ? list
        : null

  if (amount == null) {
    return { pricePesewas: 0, isPriceAvailable: false }
  }

  const original = variant?.calculated_price?.original_amount
  const compareAtPesewas =
    typeof original === "number" && Number.isFinite(original) && original > amount
      ? Math.round(original)
      : undefined

  return {
    pricePesewas: Math.round(amount),
    isPriceAvailable: true,
    compareAtPesewas,
  }
}

/**
 * Map inventory without inventing stock.
 * - explicit inventory_quantity → that number (incl. 0)
 * - otherwise → null (unknown)
 */
function extractStock(variant: MedusaVariant | undefined): number | null {
  if (!variant) return null
  if (typeof variant.inventory_quantity === "number" && Number.isFinite(variant.inventory_quantity)) {
    return variant.inventory_quantity
  }
  return null
}

function extractVendor(p: MedusaProduct): AlkemartProduct["vendor"] {
  const meta = p.metadata
  if (!meta || typeof meta !== "object") return null

  const slug =
    typeof meta.vendor_slug === "string"
      ? meta.vendor_slug
      : typeof meta.seller_slug === "string"
        ? meta.seller_slug
        : null
  const name =
    typeof meta.vendor_name === "string"
      ? meta.vendor_name
      : typeof meta.seller_name === "string"
        ? meta.seller_name
        : null

  if (!slug || !name) return null

  const ratingAvgX100 =
    typeof meta.vendor_rating_avg_x100 === "number" ? meta.vendor_rating_avg_x100 : 0
  const ratingCount =
    typeof meta.vendor_rating_count === "number" ? meta.vendor_rating_count : 0

  return { slug, name, ratingAvgX100, ratingCount }
}

function medusaToAlkemartProduct(p: MedusaProduct): AlkemartProduct {
  const variant = p.variants?.[0]
  const { pricePesewas, isPriceAvailable, compareAtPesewas } = extractPricePesewas(variant)
  const tagName = p.tags?.find((t) => PRODUCT_TAGS.has(t.name.toLowerCase()))?.name?.toLowerCase()
  const tag = (tagName as AlkemartProduct["tag"]) ?? null
  const variantId = (variant?.id ?? "") as VariantId

  return {
    id: p.id as ProductId,
    variantId,
    title: p.title,
    handle: p.handle ?? undefined,
    description: p.description ?? undefined,
    brand: p.collection?.title ?? undefined,
    tag,
    pricePesewas,
    isPriceAvailable,
    compareAtPesewas,
    ratingAvgX100: 0,
    ratingCount: 0,
    imageUrl: p.thumbnail ?? p.images?.[0]?.url ?? "",
    stock: extractStock(variant),
    sku: variant?.sku ?? variant?.id,
    categoryHandle: p.categories?.[0]?.handle,
    vendor: extractVendor(p),
  }
}

function medusaToAlkemartListItem(p: MedusaProduct): AlkemartProductListItem {
  const full = medusaToAlkemartProduct(p)
  const { description: _d, stock: _s, sku: _sku, ...rest } = full
  return rest
}

type ListProductsParams = {
  categorySlug?: string
  tag?: string
  search?: string
  limit?: number
  offset?: number
}

type ListProductsOptions = {
  query?: Partial<UseQueryOptions<{ items: AlkemartProductListItem[]; total: number }>>
}

export function useListProducts(
  params?: ListProductsParams,
  options?: ListProductsOptions,
) {
  const sdk = useMedusa()
  const { categorySlug, tag, search, limit = 24, offset = 0 } = params ?? {}
  const enabled = options?.query?.enabled ?? true

  return useQuery({
    queryKey: ["medusa", "products", { categorySlug, tag, search, limit, offset }],
    retry: false,
    throwOnError: false,
    ...options?.query,
    enabled: Boolean(enabled),
    queryFn: async () => {
      const query: Record<string, string | number | string[]> = {
        limit,
        offset,
        fields: "*variants.calculated_price,+variants.inventory_quantity",
      }
      if (search) query.q = search
      // Callers pass category handle/slug; Medusa store list filters by category_id.
      // Until slug→id resolution exists, pass through (works when an id is supplied).
      if (categorySlug) query.category_id = categorySlug

      const regionId = commerceContext.tryRegionId()
      if (regionId) query.region_id = regionId

      if (tag) query.tag_id = tag

      const response = await sdk.store.product.list(query as any)

      const products = (response.products ?? []) as MedusaProduct[]
      const count = response.count ?? products.length

      return {
        items: products.map(medusaToAlkemartListItem),
        total: count,
      }
    },
  })
}

export function useGetProduct(idOrHandle: string) {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "product", idOrHandle],
    queryFn: async () => {
      const query: Record<string, string> = {
        fields: "*variants.calculated_price,+variants.inventory_quantity,*images,*categories,*collection,*tags",
      }
      const regionId = commerceContext.tryRegionId()
      if (regionId) query.region_id = regionId

      const { product } = await sdk.store.product.retrieve(idOrHandle, query as any)
      return medusaToAlkemartProduct(product as MedusaProduct)
    },
    enabled: !!idOrHandle,
    retry: false,
    throwOnError: false,
  })
}

export function useListCategories() {
  const sdk = useMedusa()

  return useQuery({
    queryKey: ["medusa", "categories"],
    queryFn: async () => {
      const { product_categories } = await sdk.store.category.list()
      return (product_categories ?? []).map((c: any) => ({
        id: c.id as string,
        slug: c.handle as string,
        name: c.name as string,
        handle: c.handle as string,
      }))
    },
    retry: false,
    throwOnError: false,
    staleTime: 1800000,
  })
}
