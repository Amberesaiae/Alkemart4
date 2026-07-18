import { commerceContext, getMedusaClient } from "./medusa"
import {
  filterStoreSellable,
  getBackendUrl,
  getPublishableKey,
  useAlkemartCatalog,
} from "./env"
import type { SellerRef } from "@/components/seller-chip"

export type StoreProductCard = {
  id: string
  title: string
  handle?: string | null
  thumbnail?: string | null
  description?: string | null
  /** Present when store API hydrates offer on variants — never invented. */
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

/**
 * Product list often omits *seller; /store/offers carries seller on each offer.
 * Join by offer_id / product_id — never invent sellers.
 */
async function enrichSellersFromOffers(
  products: StoreProductCard[],
): Promise<StoreProductCard[]> {
  const need = products.filter((p) => !p.seller && (p.offerId || p.id))
  if (!need.length) return products

  try {
    const base = getBackendUrl()
    const pk = getPublishableKey()
    const res = await fetch(`${base}/store/offers?limit=100`, {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": pk,
      },
    })
    if (!res.ok) return products
    const data = (await res.json()) as {
      offers?: {
        id?: string
        product_id?: string
        seller?: { id?: string; name?: string; handle?: string } | null
      }[]
    }
    const byOffer = new Map<string, SellerRef>()
    const byProduct = new Map<string, SellerRef>()
    for (const o of data.offers ?? []) {
      const name = o.seller?.name?.trim()
      if (!name) continue
      const ref: SellerRef = {
        id: o.seller?.id ?? null,
        name,
        handle: o.seller?.handle ?? null,
      }
      if (o.id) byOffer.set(o.id, ref)
      if (o.product_id) byProduct.set(o.product_id, ref)
    }
    return products.map((p) => {
      if (p.seller) return p
      const fromOffer = p.offerId ? byOffer.get(p.offerId) : undefined
      const fromProduct = byProduct.get(p.id)
      const seller = fromOffer ?? fromProduct ?? null
      return seller ? { ...p, seller } : p
    })
  } catch {
    return products
  }
}

const LIST_FIELDS = "*variants.calculated_price,*seller"

/**
 * Prefer products that can be added to cart (have offer_id).
 * When `strict` (default true for production filter path): return only
 * offer-bearing rows even if that empties the list (honest empty state).
 * When not strict and no offer_ids present (API omitted fields), return
 * original list so lab UIs still render.
 */
export function preferSellableProducts<T extends { offerId?: string | null }>(
  products: T[],
  opts?: { strict?: boolean },
): T[] {
  const withOffer = products.filter((p) => Boolean(p.offerId))
  if (withOffer.length > 0) return withOffer
  if (opts?.strict) return withOffer
  return products
}

/**
 * Prefer Alkemart catalog (published + offer) when no category/search filters.
 * Falls back to Medusa product.list with client-side offer filter.
 */
async function listFromAlkemartCatalog(limit: number): Promise<{
  products: StoreProductCard[]
  count: number
} | null> {
  try {
    const base = getBackendUrl()
    const pk = getPublishableKey()
    const res = await fetch(
      `${base}/store/alkemart/catalog?limit=${encodeURIComponent(String(limit))}`,
      {
        headers: {
          Accept: "application/json",
          "x-publishable-api-key": pk,
        },
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      products?: Array<{
        id?: string
        title?: string
        handle?: string | null
        thumbnail?: string | null
        description?: string | null
        offer_id?: string | null
        seller?: {
          id?: string | null
          name?: string | null
          handle?: string | null
        } | null
      }>
      count?: number
    }
    const products: StoreProductCard[] = (data.products ?? [])
      .filter((p) => p.id)
      .map((p) => ({
        id: p.id as string,
        title: p.title ?? "Untitled",
        handle: p.handle ?? null,
        thumbnail: p.thumbnail ?? null,
        description: p.description ?? null,
        offerId: p.offer_id ?? null,
        amount: null,
        currencyCode: null,
        seller: p.seller?.name
          ? {
              id: p.seller.id ?? null,
              name: p.seller.name,
              handle: p.seller.handle ?? null,
            }
          : null,
      }))
    if (!products.length) return null
    // Prices still need region calculated_price — enrich via product.list ids if needed
    return { products, count: data.count ?? products.length }
  } catch {
    return null
  }
}

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

  const useCatalog =
    !opts?.categoryId?.trim() &&
    !opts?.q?.trim() &&
    offset === 0 &&
    useAlkemartCatalog()

  if (useCatalog) {
    const catalog = await listFromAlkemartCatalog(limit)
    if (catalog?.products.length) {
      // Hydrate prices from product.list for the catalog ids (region-aware)
      try {
        const ids = catalog.products.map((p) => p.id)
        const response = await sdk.store.product.list({
          id: ids,
          limit: ids.length,
          region_id: regionId,
          fields: LIST_FIELDS,
        } as never)
        const byId = new Map(
          ((response.products ?? []) as ProductSlice[]).map((p) => [
            p.id,
            mapProduct(p),
          ]),
        )
        const hydrated = catalog.products.map((p) => {
          const full = byId.get(p.id)
          if (!full) return p
          return {
            ...full,
            offerId: full.offerId || p.offerId,
            seller: full.seller || p.seller,
          }
        })
        return {
          products: await enrichSellersFromOffers(hydrated),
          count: catalog.count,
        }
      } catch {
        return catalog
      }
    }
  }

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

  // Over-fetch slightly so client-side sellable filter still fills the page
  const fetchLimit = Math.min(limit * 3, 100)
  query.limit = fetchLimit

  const response = await sdk.store.product.list(query as never)

  const raw = (response.products ?? []) as ProductSlice[]
  let products = await enrichSellersFromOffers(raw.map((p) => mapProduct(p)))

  // Prefer ATC-capable rows (offer_id). Search/sitemap remain stricter SoT.
  // Production builds use strict mode (empty list > non-buyable cards).
  if (filterStoreSellable()) {
    const strict = import.meta.env.PROD === true
    products = preferSellableProducts(products, { strict }).slice(0, limit)
  }

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
    const [mapped] = await enrichSellersFromOffers([
      mapProduct(product as unknown as ProductSlice),
    ])
    return mapped
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
    const [mapped] = await enrichSellersFromOffers([mapProduct(first)])
    return mapped
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
