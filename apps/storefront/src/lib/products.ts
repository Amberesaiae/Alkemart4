import { commerceContext, getMedusaClient } from "./medusa"
import type { SellerRef } from "@/components/seller-chip"

export type StoreProductCard = {
  id: string
  title: string
  handle?: string | null
  thumbnail?: string | null
  description?: string | null
  /** Present when Mercur hydrates offer on variants — never invented. */
  offerId?: string | null
  /** Major currency units from calculated_price — only if API returns them. */
  amount?: number | null
  currencyCode?: string | null
  /** Seller identity if store API returns it — omit when missing. */
  seller?: SellerRef | null
}

type VariantSlice = {
  offer_id?: string | null
  calculated_price?: {
    calculated_amount?: number | null
    currency_code?: string | null
  } | null
}

type ProductSlice = {
  id: string
  title?: string | null
  handle?: string | null
  thumbnail?: string | null
  description?: string | null
  variants?: VariantSlice[] | null
  /** Possible Mercur/extensions — only used if present */
  seller?: { id?: string; name?: string; handle?: string } | null
  metadata?: Record<string, unknown> | null
}

function extractSeller(p: ProductSlice): SellerRef | null {
  if (p.seller?.name) {
    return {
      id: p.seller.id,
      name: p.seller.name,
      handle: p.seller.handle,
    }
  }
  const meta = p.metadata
  if (meta && typeof meta.seller_name === "string" && meta.seller_name.trim()) {
    return {
      name: meta.seller_name.trim(),
      handle:
        typeof meta.seller_handle === "string" ? meta.seller_handle : null,
      id: typeof meta.seller_id === "string" ? meta.seller_id : null,
    }
  }
  return null
}

function mapProduct(p: ProductSlice): StoreProductCard {
  const variant = p.variants?.[0]
  const calc = variant?.calculated_price
  return {
    id: p.id,
    title: p.title ?? "Untitled",
    handle: p.handle,
    thumbnail: p.thumbnail,
    description: p.description ?? null,
    offerId: typeof variant?.offer_id === "string" ? variant.offer_id : null,
    amount:
      calc?.calculated_amount != null
        ? Number(calc.calculated_amount)
        : null,
    currencyCode: calc?.currency_code ?? null,
    seller: extractSeller(p),
  }
}

const LIST_FIELDS = "*variants.calculated_price,*seller"

/**
 * List published store products for the configured region.
 * Optional categoryId from product-categories API — never invent category ids.
 */
export async function listStoreProducts(opts?: {
  limit?: number
  offset?: number
  /** Medusa category id from API, not a display slug invented in UI */
  categoryId?: string
  q?: string
}): Promise<{
  products: StoreProductCard[]
  count: number
}> {
  const sdk = getMedusaClient()
  const { regionId } = commerceContext()
  const limit = opts?.limit ?? 24
  const offset = opts?.offset ?? 0

  const query: Record<string, unknown> = {
    limit,
    offset,
    region_id: regionId,
    fields: LIST_FIELDS,
  }
  if (opts?.categoryId?.trim()) {
    query.category_id = opts.categoryId.trim()
  }
  if (opts?.q?.trim()) {
    query.q = opts.q.trim()
  }

  const response = await sdk.store.product.list(query as never)

  const raw = (response.products ?? []) as ProductSlice[]
  const products = raw.map((p) => mapProduct(p))

  return {
    products,
    count: Number(response.count ?? products.length),
  }
}

/**
 * Retrieve one product by id or handle from the store API.
 */
export async function getStoreProduct(
  idOrHandle: string,
): Promise<StoreProductCard> {
  const key = idOrHandle.trim()
  if (!key) throw new Error("Product id or handle is required")

  const sdk = getMedusaClient()
  const { regionId } = commerceContext()
  const fields = `${LIST_FIELDS},+description`

  try {
    const { product } = await sdk.store.product.retrieve(key, {
      region_id: regionId,
      fields,
    } as Record<string, unknown>)
    if (!product?.id) throw new Error("Product not found")
    return mapProduct(product as unknown as ProductSlice)
  } catch {
    const list = await sdk.store.product.list({
      handle: key,
      region_id: regionId,
      limit: 1,
      fields,
    } as Record<string, unknown>)
    const first = (list.products ?? [])[0] as ProductSlice | undefined
    if (!first?.id) {
      throw new Error(`Product not found: ${key}`)
    }
    return mapProduct(first)
  }
}

export type StoreCategory = {
  id: string
  name: string
  handle?: string | null
}

/**
 * Related products: prefer same seller when API provided seller identity.
 * Falls back to other catalog products (same list API). Never invents products.
 */
export async function listRelatedProducts(opts: {
  excludeProductId: string
  sellerId?: string | null
  sellerName?: string | null
  limit?: number
}): Promise<{
  products: StoreProductCard[]
  /** How the list was filtered — for honest UI labels only */
  mode: "seller" | "catalog"
}> {
  const limit = opts.limit ?? 8
  const { products } = await listStoreProducts({ limit: 48 })
  const exclude = opts.excludeProductId
  const others = products.filter((p) => p.id !== exclude)

  const sellerId = opts.sellerId?.trim()
  const sellerName = opts.sellerName?.trim()?.toLowerCase()

  if (sellerId || sellerName) {
    const sameSeller = others.filter((p) => {
      if (sellerId && p.seller?.id === sellerId) return true
      if (
        sellerName &&
        p.seller?.name?.trim().toLowerCase() === sellerName
      ) {
        return true
      }
      return false
    })
    if (sameSeller.length > 0) {
      return { products: sameSeller.slice(0, limit), mode: "seller" }
    }
  }

  return { products: others.slice(0, limit), mode: "catalog" }
}

/** Categories from store API — empty array is valid (section should hide). */
export async function listStoreCategories(): Promise<StoreCategory[]> {
  const sdk = getMedusaClient()
  try {
    const res = await sdk.store.category.list({ limit: 50 })
    const cats = (res.product_categories ?? res.categories ?? []) as {
      id: string
      name?: string
      handle?: string
    }[]
    return cats
      .filter((c) => c?.id && c?.name)
      .map((c) => ({
        id: c.id,
        name: c.name!,
        handle: c.handle ?? null,
      }))
  } catch {
    // Some builds expose product-categories differently
    const base = (await import("./env")).getBackendUrl()
    const pk = (await import("./env")).getPublishableKey()
    const http = await fetch(`${base}/store/product-categories?limit=50`, {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": pk,
      },
    })
    if (!http.ok) return []
    const data = (await http.json()) as {
      product_categories?: { id: string; name?: string; handle?: string }[]
    }
    return (data.product_categories ?? [])
      .filter((c) => c?.id && c?.name)
      .map((c) => ({
        id: c.id,
        name: c.name!,
        handle: c.handle ?? null,
      }))
  }
}
