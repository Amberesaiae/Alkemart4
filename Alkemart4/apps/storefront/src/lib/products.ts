import { commerceContext, getMedusaClient } from "./medusa"
import {
  filterStoreSellable,
  getAlkemartApiUrl,
  getBackendUrl,
  getPublishableKey,
  useAlkemartCatalog,
  useCloudflareCatalog,
} from "./env"
import {
  getCatalog,
  getCategories,
  getProduct,
  getSellerShop,
  setBaseUrl,
  type PeerOffer as CfPeerOffer,
  type ProductCard as CfProductCard,
  type ProductDetail as CfProductDetail,
} from "./api-client"
import type { SellerRef } from "@/components/seller-chip"
import { pesewasToMajor } from "@alkemart/shared/ghana"

export type StoreProductCard = {
  id: string
  title: string
  handle?: string | null
  thumbnail?: string | null
  images?: { url: string }[] | null
  description?: string | null
  /** Present when store API hydrates offer on variants — never invented. */
  offerId?: string | null
  /** Major currency units for Price display — derived from API (never invented). */
  amount?: number | null
  currencyCode?: string | null
  /** Multivendor: number of sellable peer offers on this product. */
  offerCount?: number | null
  /** Processed webp thumbnail (thumb_url) when available. */
  thumbUrl?: string | null
  /** Processed webp full-size (web_url) when available. */
  webUrl?: string | null
  /** Seller identity if store API returns it — omit when missing. */
  seller?: SellerRef | null
  /** Variant option types in display order (V1 matrix; empty for legacy). */
  optionTypes?: { name: string; values: { value: string; imageUrl: string | null }[] }[]
  /**
   * Structured facts about the item — what it *is* (1ltr, glass bottle),
   * as opposed to optionTypes, which is what a buyer *chooses*.
   */
  attributes?: { label: string; value: string }[]
  /** Aggregate of published reviews. */
  ratingAvg?: number | null
  ratingCount?: number
  reviews?: { rating: number; title: string | null; body: string; vendorResponse: string | null; createdAt: string }[]
  /** Every combination incl. unstocked/archived. */
  combos?: {
    offerId: string
    sellerId: string
    options: Record<string, string>
    amount: number | null
    availableQty: number
    active: boolean
  }[]
  /**
   * Frontend homepage demo seed only — not from Medusa.
   * Cards must not invent offers; add-to-cart stays disabled.
   */
  demo?: boolean
  /** Browse slug when demo product is clicked instead of PDP */
  demoCategory?: string
  /**
   * Mowafer tiny category line above title (“Televisions”, “Mobile Phones”).
   * Demo seed or API metadata only — never invented in the card.
   */
  categoryLabel?: string | null
  /** Real category handles from the API taxonomy — prefer over heuristics. */
  categoryHandles?: string[] | null
  /** ISO timestamp of product creation — for "recently added" sort. */
  createdAt?: string | null
  /** 0–5 star rating when known (demo / reviews API). */
  rating?: number | null
  /** Sellable units behind the card's best offer — null when unknown. */
  availableQty?: number | null
}

function ensureCloudflareBaseUrl(): void {
  const url = getAlkemartApiUrl()
  if (url) setBaseUrl(url)
}

function pesewasStringToMajor(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null
  try {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return null
    return pesewasToMajor(n)
  } catch {
    return null
  }
}

/**
 * Ratings ride along with the catalogue card response (joined from published
 * reviews). The generated client type predates the fields, so read them
 * defensively — and treat "no reviews" as absent, never as zero.
 */
function readCardRating(c: CfProductCard): { ratingAvg: number | null; ratingCount: number } {
  const raw = c as unknown as { ratingAvg?: unknown; ratingCount?: unknown }
  const count =
    typeof raw.ratingCount === "number" && Number.isFinite(raw.ratingCount) && raw.ratingCount > 0
      ? Math.trunc(raw.ratingCount)
      : 0
  const avg =
    typeof raw.ratingAvg === "number" && Number.isFinite(raw.ratingAvg) && count > 0
      ? raw.ratingAvg
      : null
  return avg == null ? { ratingAvg: null, ratingCount: 0 } : { ratingAvg: avg, ratingCount: count }
}

function mapCfProductCard(c: CfProductCard): StoreProductCard {
  return {
    id: c.productId,
    title: c.title,
    handle: null,
    thumbnail: c.imageUrl ?? null,
    thumbUrl: c.imageUrl ?? null,
    offerId: c.bestOfferId,
    offerCount: c.offerCount,
    amount: pesewasStringToMajor(c.fromPricePesewas),
    currencyCode: c.currency === "ghs" ? "ghs" : c.currency,
    categoryLabel: c.categoryName,
    categoryHandles: c.categoryHandle ? [c.categoryHandle] : null,
    seller: c.sellerName
      ? {
          id: c.sellerId,
          name: c.sellerName,
          handle: c.sellerHandle,
        }
      : null,
    availableQty: typeof c.availableQty === "number" ? c.availableQty : null,
    createdAt: c.createdAt ?? null,
    ...readCardRating(c),
  }
}

function readAttributes(d: unknown): { label: string; value: string }[] {
  const raw = (d as { attributes?: unknown } | null)?.attributes
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (a): a is { label: string; value: string } =>
      a != null &&
      typeof a === "object" &&
      typeof (a as { label?: unknown }).label === "string" &&
      typeof (a as { value?: unknown }).value === "string",
  )
}

function mapCfDetail(d: CfProductDetail): StoreProductCard {
  const best = d.offers[0]
  return {
    id: d.productId,
    title: d.title,
    description: d.description ?? null,
    thumbnail: d.imageUrls?.[0] ?? null,
    images: (d.imageUrls ?? []).map((url) => ({ url })),
    thumbUrl: d.imageUrls?.[0] ?? null,
    offerId: best?.offerId ?? null,
    offerCount: d.offers.length,
    amount: best ? pesewasStringToMajor(best.pricePesewas) : null,
    currencyCode: best?.currency === "ghs" ? "ghs" : best?.currency ?? "ghs",
    categoryLabel: d.categoryName,
    categoryHandles: d.categoryHandle ? [d.categoryHandle] : null,
    // `attributes` ships on the API response but is not yet in the generated
    // OpenAPI client type, so it is read defensively here. Regenerating
    // packages/api-client from the spec removes the cast.
    attributes: readAttributes(d),
    seller: best
      ? {
          id: best.sellerId,
          name: best.sellerName,
          handle: best.sellerHandle,
        }
      : null,
    optionTypes: (d.optionTypes ?? []).map((t) => ({
      name: t.name,
      values: (t.values ?? []).map((v) => ({ value: v.value, imageUrl: v.imageUrl ?? null })),
    })),
    combos: (d.combos ?? []).map((c) => ({
      offerId: c.offerId,
      sellerId: c.sellerId,
      options: c.options ?? {},
      amount: pesewasStringToMajor(c.pricePesewas),
      availableQty: c.availableQty,
      active: c.active,
    })),
    ratingAvg: d.ratingAvg ?? null,
    ratingCount: d.ratingCount ?? 0,
    reviews: (d.reviews ?? []).map((r) => ({
      rating: r.rating,
      title: r.title,
      body: r.body,
      vendorResponse: r.vendorResponse,
      createdAt: r.createdAt,
    })),
  }
}

function mapCfPeer(o: CfPeerOffer, productId: string): PeerOffer {
  return {
    offerId: o.offerId,
    options: o.options ?? {},
    productId,
    seller: {
      id: o.sellerId,
      name: o.sellerName,
      handle: o.sellerHandle,
    },
    amount: pesewasStringToMajor(o.pricePesewas),
    currencyCode: o.currency === "ghs" ? "ghs" : o.currency,
  }
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
  images?: { url: string }[] | null
  description?: string | null
  created_at?: string | null
  categories?: { handle?: string | null; name?: string | null }[] | null
  variants?: VariantSlice[] | null
  /** Possible Mercur/extensions — only used if present */
  seller?: { id?: string; name?: string; handle?: string } | null
  metadata?: Record<string, unknown> | null
}

function readAlkemartImageMeta(meta: Record<string, unknown> | null | undefined): {
  thumbUrl: string | null
  webUrl: string | null
} {
  if (!meta) return { thumbUrl: null, webUrl: null }
  const alk = meta.alkemart
  const media =
    alk && typeof alk === "object" && (alk as Record<string, unknown>).media
      ? (alk as Record<string, unknown>).media as Record<string, unknown>
      : {}
  const thumb =
    typeof media.thumb_url === "string" && media.thumb_url ? media.thumb_url : null
  const web =
    typeof media.web_url === "string" && media.web_url ? media.web_url : null
  return { thumbUrl: thumb, webUrl: web }
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
    images: p.images ?? null,
    description: p.description ?? null,
    offerId: typeof variant?.offer_id === "string" ? variant.offer_id : null,
    createdAt: typeof p.created_at === "string" ? p.created_at : null,
    categoryHandles:
      (p.categories ?? [])
        .map((c) => (c.handle || "").toLowerCase())
        .filter(Boolean) ?? null,
    amount:
      calc?.calculated_amount != null
        ? Number(calc.calculated_amount)
        : null,
         currencyCode: calc?.currency_code ?? null,
         seller: extractSeller(p),
         ...readAlkemartImageMeta(p.metadata),
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

const LIST_FIELDS = "*variants.calculated_price,*seller,*images,*metadata,categories.handle,created_at"

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

type CatalogQuery = {
  limit: number
  offset?: number
  sellerHandle?: string
  categoryHandle?: string
  sort?: "newest" | "price_asc" | "price_desc"
}

/**
 * Prefer Alkemart catalog (published + offer) when no category/search filters.
 * Supports server-side seller_handle / category_handle.
 * Falls back to Medusa product.list with client-side offer filter.
 */
async function listFromAlkemartCatalog(opts: CatalogQuery): Promise<{
  products: StoreProductCard[]
  count: number
} | null> {
  try {
    const base = getBackendUrl()
    const pk = getPublishableKey()
    const params = new URLSearchParams()
    params.set("limit", String(opts.limit))
    if (opts.offset && opts.offset > 0) {
      params.set("offset", String(opts.offset))
    }
    if (opts.sellerHandle?.trim()) {
      params.set("seller_handle", opts.sellerHandle.trim())
    }
    if (opts.categoryHandle?.trim()) {
      params.set("category_handle", opts.categoryHandle.trim())
    }
    const res = await fetch(
      `${base}/store/alkemart/catalog?${params.toString()}`,
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
          category_label?: string | null
          category_handles?: string[] | null
          created_at?: string | null
          min_price?: number | null
         currency_code?: string | null
         thumb_url?: string | null
         web_url?: string | null
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
        createdAt: p.created_at ?? null,
        amount: p.min_price != null ? Number(p.min_price) : null,
         currencyCode: p.currency_code ?? null,
         categoryLabel: p.category_label?.trim() || null,
         categoryHandles:
          (p.category_handles ?? [])
            .map((h) => h.toLowerCase())
            .filter(Boolean) || null,
         thumbUrl: p.thumb_url ?? null,
         webUrl: p.web_url ?? null,
         seller: p.seller?.name
          ? {
              id: p.seller.id ?? null,
              name: p.seller.name,
              handle: p.seller.handle ?? null,
            }
          : null,
      }))
    // Empty list is valid when seller/category filter matches nothing
    if (
      !products.length &&
      !opts.sellerHandle?.trim() &&
      !opts.categoryHandle?.trim()
    ) {
      return null
    }
    return { products, count: data.count ?? products.length }
  } catch {
    return null
  }
}

/**
 * List published store products for the configured region.
 * Optional categoryId from product-categories API — never invent category ids.
 * sellerHandle / categoryHandle use server catalog filters (no client invent).
 */
/**
 * Popularity shelves, from real orders only.
 *
 * `window: "7d"` ranks by the last week ("Trending"); omitted ranks all time
 * ("Most ordered"). Returns an empty list when nothing has been ordered — a
 * popularity shelf on a young catalogue renders empty rather than quietly
 * degrading into "newest" dressed up as popular.
 */
export const DEMO_CATALOG_PRODUCTS: StoreProductCard[] = [
  {
    id: "prod-tecno-spark",
    title: "Ninja Professional Countertop Blender Set",
    description: "High-power countertop blender with two single-serve cups for smoothies and everyday food prep.",
    thumbnail: "/images/products/demo/countertop-blender.jpg",
    images: [{ url: "/images/products/demo/countertop-blender.jpg" }],
    thumbUrl: "/images/products/demo/countertop-blender.jpg",
    offerId: "offer-tecno-spark",
    offerCount: 2,
    amount: 1490,
    currencyCode: "ghs",
    categoryLabel: "Home & Living",
    categoryHandles: ["home-living", "kitchen-appliances"],
    ratingAvg: 4.9,
    ratingCount: 38,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 15,
  },
  {
    id: "prod-smart-tv",
    title: "Samsung 55\" Crystal UHD 4K Smart TV",
    description: "Vivid 4K resolution with Crystal Processor, Slim design, and built-in streaming apps.",
    thumbnail: "/images/products/demo/smart-tv.jpg",
    images: [{ url: "/images/products/demo/smart-tv.jpg" }],
    thumbUrl: "/images/products/demo/smart-tv.jpg",
    offerId: "offer-smart-tv",
    offerCount: 3,
    amount: 6800,
    currencyCode: "ghs",
    categoryLabel: "Phones & Electronics",
    categoryHandles: ["phones-electronics", "tvs-audio"],
    ratingAvg: 4.8,
    ratingCount: 45,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 10,
  },
  {
    id: "prod-flagship-phone",
    title: "Aethelgard Terra 12 Pro 5G Smartphone",
    description: "Titanium chassis, triple camera lens system, fast charging and 120Hz AMOLED display.",
    thumbnail: "/images/products/demo/flagship-phone.jpg",
    images: [{ url: "/images/products/demo/flagship-phone.jpg" }],
    thumbUrl: "/images/products/demo/flagship-phone.jpg",
    offerId: "offer-flagship-phone",
    offerCount: 4,
    amount: 9200,
    currencyCode: "ghs",
    categoryLabel: "Phones & Electronics",
    categoryHandles: ["phones-electronics", "phones"],
    ratingAvg: 4.9,
    ratingCount: 82,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 12,
  },
  {
    id: "prod-wireless-headphones",
    title: "Sonos Ace Noise-Canceling Wireless Headphones",
    description: "Lossless audio streaming, active noise cancellation, ultra-soft memory foam earcups.",
    thumbnail: "/images/products/demo/wireless-headphones.jpg",
    images: [{ url: "/images/products/demo/wireless-headphones.jpg" }],
    thumbUrl: "/images/products/demo/wireless-headphones.jpg",
    offerId: "offer-wireless-headphones",
    offerCount: 2,
    amount: 3450,
    currencyCode: "ghs",
    categoryLabel: "Phones & Electronics",
    categoryHandles: ["phones-electronics", "tvs-audio", "accessories"],
    ratingAvg: 4.9,
    ratingCount: 29,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 18,
  },
  {
    id: "prod-shea-butter-balm",
    title: "Organic Ghanaian Raw Whipped Shea Butter Balm",
    description: "Deeply moisturizing unrefined raw shea butter balm enriched with vitamin E and jojoba oil.",
    thumbnail: "/images/products/demo/shea-butter-balm.jpg",
    images: [{ url: "/images/products/demo/shea-butter-balm.jpg" }],
    thumbUrl: "/images/products/demo/shea-butter-balm.jpg",
    offerId: "offer-shea-butter-balm",
    offerCount: 3,
    amount: 180,
    currencyCode: "ghs",
    categoryLabel: "Health & Beauty",
    categoryHandles: ["health-beauty"],
    ratingAvg: 5.0,
    ratingCount: 64,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 50,
  },
  {
    id: "prod-starface-patches",
    title: "Starface Hydro-Stars Hydrocolloid Acne Patches",
    description: "Hydrocolloid spot patches designed to absorb fluid and accelerate pimple healing.",
    thumbnail: "/images/products/demo/starface-patches.jpg",
    images: [{ url: "/images/products/demo/starface-patches.jpg" }],
    thumbUrl: "/images/products/demo/starface-patches.jpg",
    offerId: "offer-starface-patches",
    offerCount: 1,
    amount: 140,
    currencyCode: "ghs",
    categoryLabel: "Health & Beauty",
    categoryHandles: ["health-beauty"],
    ratingAvg: 4.7,
    ratingCount: 33,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 35,
  },
  {
    id: "prod-jasmine-rice",
    title: "Royal Aroma Premium Jasmine Fragrant Rice 5kg",
    description: "Long-grain naturally aromatic jasmine rice, carefully processed for perfect fluffiness.",
    thumbnail: "/images/products/demo/jasmine-rice.jpg",
    images: [{ url: "/images/products/demo/jasmine-rice.jpg" }],
    thumbUrl: "/images/products/demo/jasmine-rice.jpg",
    offerId: "offer-jasmine-rice",
    offerCount: 2,
    amount: 210,
    currencyCode: "ghs",
    categoryLabel: "Food & Groceries",
    categoryHandles: ["food-groceries", "staples"],
    ratingAvg: 4.8,
    ratingCount: 78,
    seller: {
      id: "v-ejs",
      name: "EJ's Mart & Groceries",
      handle: "ejs-cuisine",
    },
    availableQty: 60,
  },
  {
    id: "prod-roasted-coffee",
    title: "Goldstar Artisan Dark Roast Whole Bean Coffee 1kg",
    description: "Rich dark roast coffee beans with notes of dark chocolate and caramel sweetness.",
    thumbnail: "/images/products/demo/roasted-coffee.jpg",
    images: [{ url: "/images/products/demo/roasted-coffee.jpg" }],
    thumbUrl: "/images/products/demo/roasted-coffee.jpg",
    offerId: "offer-roasted-coffee",
    offerCount: 2,
    amount: 260,
    currencyCode: "ghs",
    categoryLabel: "Beverages",
    categoryHandles: ["beverages"],
    ratingAvg: 4.9,
    ratingCount: 42,
    seller: {
      id: "v-ejs",
      name: "EJ's Mart & Groceries",
      handle: "ejs-cuisine",
    },
    availableQty: 30,
  },
  {
    id: "prod-bento-box",
    title: "Bentgo Kids Leak-Proof Bento Box",
    description: "Durable 5-compartment bento lunch box with drop-proof rubberized edges.",
    thumbnail: "/images/products/demo/bento-box.jpg",
    images: [{ url: "/images/products/demo/bento-box.jpg" }],
    thumbUrl: "/images/products/demo/bento-box.jpg",
    offerId: "offer-bento-box",
    offerCount: 1,
    amount: 320,
    currencyCode: "ghs",
    categoryLabel: "Baby & Kids",
    categoryHandles: ["baby-kids"],
    ratingAvg: 4.9,
    ratingCount: 26,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 22,
  },
  {
    id: "prod-kids-cotton-tee",
    title: "Soft Organic Cotton Everyday Kids T-Shirt",
    description: "Breathable 100% organic cotton crewneck tee built for comfort and playtime.",
    thumbnail: "/images/products/demo/kids-cotton-tee.jpg",
    images: [{ url: "/images/products/demo/kids-cotton-tee.jpg" }],
    thumbUrl: "/images/products/demo/kids-cotton-tee.jpg",
    offerId: "offer-kids-cotton-tee",
    offerCount: 2,
    amount: 110,
    currencyCode: "ghs",
    categoryLabel: "Baby & Kids",
    categoryHandles: ["baby-kids", "fashion-apparel"],
    ratingAvg: 4.7,
    ratingCount: 18,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 40,
  },
  {
    id: "prod-pet-care-kit",
    title: "Complete Paw Care & Grooming Kit for Dogs",
    description: "Grooming set including gentle slicker brush, nail clippers, and paw conditioning balm.",
    thumbnail: "/images/products/demo/pet-care-kit.jpg",
    images: [{ url: "/images/products/demo/pet-care-kit.jpg" }],
    thumbUrl: "/images/products/demo/pet-care-kit.jpg",
    offerId: "offer-pet-care-kit",
    offerCount: 1,
    amount: 240,
    currencyCode: "ghs",
    categoryLabel: "Pet Care",
    categoryHandles: ["pet-care"],
    ratingAvg: 4.8,
    ratingCount: 15,
    seller: {
      id: "v-ejs",
      name: "EJ's Mart & Groceries",
      handle: "ejs-cuisine",
    },
    availableQty: 14,
  },
  {
    id: "prod-kente-cloth",
    title: "DeWalt Cordless Drill and Impact Driver Kit",
    description: "Two-tool cordless kit with batteries, charger and a durable carry bag.",
    thumbnail: "/images/products/demo/cordless-tool-kit.jpg",
    images: [{ url: "/images/products/demo/cordless-tool-kit.jpg" }],
    thumbUrl: "/images/products/demo/cordless-tool-kit.jpg",
    offerId: "offer-kente-cloth",
    offerCount: 1,
    amount: 2850,
    currencyCode: "ghs",
    categoryLabel: "Home & Living",
    categoryHandles: ["home-living", "tools"],
    ratingAvg: 5.0,
    ratingCount: 24,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 8,
  },
  {
    id: "prod-shea-butter",
    title: "Classic Black Comfort Clogs",
    description: "Lightweight everyday clogs with ventilation ports and an adjustable heel strap.",
    thumbnail: "/images/products/demo/classic-clogs.jpg",
    images: [{ url: "/images/products/demo/classic-clogs.jpg" }],
    thumbUrl: "/images/products/demo/classic-clogs.jpg",
    offerId: "offer-shea-butter",
    offerCount: 1,
    amount: 420,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "footwear"],
    ratingAvg: 4.9,
    ratingCount: 52,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 40,
  },
  {
    id: "prod-royal-aroma-rice",
    title: "Rust Orange Everyday Bomber Jacket",
    description: "Versatile lightweight bomber jacket with a clean zip front and ribbed trims.",
    thumbnail: "/images/products/demo/bomber-jacket.jpg",
    images: [{ url: "/images/products/demo/bomber-jacket.jpg" }],
    thumbUrl: "/images/products/demo/bomber-jacket.jpg",
    offerId: "offer-royal-rice",
    offerCount: 3,
    amount: 395,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "outerwear"],
    ratingAvg: 4.8,
    ratingCount: 67,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 25,
  },
  {
    id: "prod-leather-tote",
    title: "Handcrafted Genuine Leather Everyday Tote Bag",
    description: "Spacious premium leather tote featuring inner zipper pocket and reinforced handles.",
    thumbnail: "/images/products/demo/leather-tote.jpg",
    images: [{ url: "/images/products/demo/leather-tote.jpg" }],
    thumbUrl: "/images/products/demo/leather-tote.jpg",
    offerId: "offer-leather-tote",
    offerCount: 2,
    amount: 890,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "bags"],
    ratingAvg: 4.9,
    ratingCount: 31,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 15,
  },
  {
    id: "prod-wireless-earbuds",
    title: "Microfiber Cleaning Cloths, 12-Pack",
    description: "Soft reusable microfiber cloths for kitchen, glass, appliances and everyday cleaning.",
    thumbnail: "/images/products/demo/microfiber-cloths.jpg",
    images: [{ url: "/images/products/demo/microfiber-cloths.jpg" }],
    thumbUrl: "/images/products/demo/microfiber-cloths.jpg",
    offerId: "offer-oraimo-buds",
    offerCount: 2,
    amount: 95,
    currencyCode: "ghs",
    categoryLabel: "Home & Living",
    categoryHandles: ["home-living", "cleaning"],
    ratingAvg: 4.7,
    ratingCount: 41,
    seller: {
      id: "v-ejs",
      name: "EJ's Mart & Groceries",
      handle: "ejs-cuisine",
    },
    availableQty: 18,
  },
  {
    id: "prod-desk-lamp",
    title: "Minimalist LED Touch Desk Lamp with Wireless Charging",
    description: "Dimmable eye-caring desk lamp with integrated fast wireless phone charger pad.",
    thumbnail: "/images/products/demo/desk-lamp.jpg",
    images: [{ url: "/images/products/demo/desk-lamp.jpg" }],
    thumbUrl: "/images/products/demo/desk-lamp.jpg",
    offerId: "offer-desk-lamp",
    offerCount: 1,
    amount: 450,
    currencyCode: "ghs",
    categoryLabel: "Home & Living",
    categoryHandles: ["home-living", "phones-electronics"],
    ratingAvg: 4.8,
    ratingCount: 37,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 20,
  },
  {
    id: "prod-mens-linen-shirt",
    title: "Glass Food Storage Container Set",
    description: "Clear stackable food containers with secure lids for meal prep and pantry storage.",
    thumbnail: "/images/products/demo/glass-containers.jpg",
    images: [{ url: "/images/products/demo/glass-containers.jpg" }],
    thumbUrl: "/images/products/demo/glass-containers.jpg",
    offerId: "offer-linen-shirt",
    offerCount: 1,
    amount: 280,
    currencyCode: "ghs",
    categoryLabel: "Home & Living",
    categoryHandles: ["home-living", "kitchen-storage"],
    ratingAvg: 4.8,
    ratingCount: 19,
    seller: {
      id: "v-ejs",
      name: "EJ's Mart & Groceries",
      handle: "ejs-cuisine",
    },
    availableQty: 12,
  },
  {
    id: "prod-gold-necklace",
    title: "18K Solid Gold Layered Sunburst Pendant Necklace",
    description: "Exquisite 18-karat solid yellow gold necklace featuring a radiant sunburst pendant on an adjustable cable chain.",
    thumbnail: "/images/products/demo/gold-necklace.jpg",
    images: [{ url: "/images/products/demo/gold-necklace.jpg" }],
    thumbUrl: "/images/products/demo/gold-necklace.jpg",
    offerId: "offer-gold-necklace",
    offerCount: 2,
    amount: 3850,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "accessories"],
    ratingAvg: 5.0,
    ratingCount: 42,
    seller: {
      id: "v-glow",
      name: "Glow & Glamour Beauty",
      handle: "glow-glamour",
    },
    availableQty: 8,
  },
  {
    id: "prod-gold-earrings",
    title: "18K Gold Plated Chunky Twist Hoop Earrings",
    description: "Lightweight hypoallergenic chunky twist hoops with secure latch backs. High-polish radiant finish.",
    thumbnail: "/images/products/demo/gold-earrings.jpg",
    images: [{ url: "/images/products/demo/gold-earrings.jpg" }],
    thumbUrl: "/images/products/demo/gold-earrings.jpg",
    offerId: "offer-gold-earrings",
    offerCount: 2,
    amount: 550,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "accessories"],
    ratingAvg: 4.9,
    ratingCount: 38,
    seller: {
      id: "v-glow",
      name: "Glow & Glamour Beauty",
      handle: "glow-glamour",
    },
    availableQty: 25,
  },
  {
    id: "prod-gold-signet-ring",
    title: "Polished 14K Yellow Gold Oval Signet Ring",
    description: "Timeless heirloom-grade oval signet ring crafted from solid 14-karat gold with smooth comfort-fit band.",
    thumbnail: "/images/products/demo/gold-signet-ring.jpg",
    images: [{ url: "/images/products/demo/gold-signet-ring.jpg" }],
    thumbUrl: "/images/products/demo/gold-signet-ring.jpg",
    offerId: "offer-gold-signet-ring",
    offerCount: 1,
    amount: 2400,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "accessories"],
    ratingAvg: 4.8,
    ratingCount: 22,
    seller: {
      id: "v-glow",
      name: "Glow & Glamour Beauty",
      handle: "glow-glamour",
    },
    availableQty: 10,
  },
  {
    id: "prod-beaded-bracelet",
    title: "Handmade Ghanaian Brass & Glass Bead Bracelet",
    description: "Artisanal Krobo recycled glass beads paired with hand-cast recycled brass accents on durable cord.",
    thumbnail: "/images/products/demo/beaded-bracelet.jpg",
    images: [{ url: "/images/products/demo/beaded-bracelet.jpg" }],
    thumbUrl: "/images/products/demo/beaded-bracelet.jpg",
    offerId: "offer-beaded-bracelet",
    offerCount: 3,
    amount: 160,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "accessories"],
    ratingAvg: 4.9,
    ratingCount: 56,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 30,
  },
  {
    id: "prod-chronograph-watch",
    title: "Minimalist Chronograph Black Leather Wristwatch",
    description: "Precision quartz chronograph timepiece with scratch-resistant sapphire crystal and supple calfskin leather strap.",
    thumbnail: "/images/products/demo/chronograph-watch.jpg",
    images: [{ url: "/images/products/demo/chronograph-watch.jpg" }],
    thumbUrl: "/images/products/demo/chronograph-watch.jpg",
    offerId: "offer-chronograph-watch",
    offerCount: 2,
    amount: 1250,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "accessories"],
    ratingAvg: 4.9,
    ratingCount: 65,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 14,
  },
  {
    id: "prod-aviator-sunglasses",
    title: "Polarized Classic Gold Aviator Sunglasses",
    description: "Vintage-inspired teardrop aviator frame with UV400 polarized gradient lenses and adjustable silicone nose pads.",
    thumbnail: "/images/products/demo/aviator-sunglasses.jpg",
    images: [{ url: "/images/products/demo/aviator-sunglasses.jpg" }],
    thumbUrl: "/images/products/demo/aviator-sunglasses.jpg",
    offerId: "offer-aviator-sunglasses",
    offerCount: 2,
    amount: 380,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "accessories"],
    ratingAvg: 4.7,
    ratingCount: 29,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 20,
  },
  {
    id: "prod-authentic-kente",
    title: "Handwoven Authentic Ashanti Kente Cloth 3-Piece Set",
    description: "Master-woven silk and cotton ceremonial Kente cloth directly from Bonwire, rich in heritage symbolism.",
    thumbnail: "/images/products/demo/authentic-kente.jpg",
    images: [{ url: "/images/products/demo/authentic-kente.jpg" }],
    thumbUrl: "/images/products/demo/authentic-kente.jpg",
    offerId: "offer-authentic-kente",
    offerCount: 1,
    amount: 3200,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel"],
    ratingAvg: 5.0,
    ratingCount: 34,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 6,
  },
  {
    id: "prod-bolga-basket",
    title: "Handwoven Bolgatanga Elephant Grass Market Basket",
    description: "Robust fair-trade handwoven market tote crafted from natural Veta Vera straw with comfortable leather-wrapped handle.",
    thumbnail: "/images/products/demo/bolga-basket.jpg",
    images: [{ url: "/images/products/demo/bolga-basket.jpg" }],
    thumbUrl: "/images/products/demo/bolga-basket.jpg",
    offerId: "offer-bolga-basket",
    offerCount: 2,
    amount: 290,
    currencyCode: "ghs",
    categoryLabel: "Home & Living",
    categoryHandles: ["home-living", "fashion-apparel", "bags"],
    ratingAvg: 4.9,
    ratingCount: 71,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 18,
  },
  {
    id: "prod-leather-sandals",
    title: "Handcrafted Leather Cross-Strap Slide Sandals",
    description: "Full-grain vegetable-tanned leather slides with cushioned arch support and non-slip rubber tread.",
    thumbnail: "/images/products/demo/leather-sandals.jpg",
    images: [{ url: "/images/products/demo/leather-sandals.jpg" }],
    thumbUrl: "/images/products/demo/leather-sandals.jpg",
    offerId: "offer-leather-sandals",
    offerCount: 2,
    amount: 340,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "footwear"],
    ratingAvg: 4.8,
    ratingCount: 43,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 22,
  },
  {
    id: "prod-bifold-wallet",
    title: "Handmade Full-Grain Leather Bi-Fold Wallet",
    description: "Slim RFID-blocking wallet handcrafted from supple oil-waxed leather with 8 card slots and bill compartment.",
    thumbnail: "/images/products/demo/bifold-wallet.jpg",
    images: [{ url: "/images/products/demo/bifold-wallet.jpg" }],
    thumbUrl: "/images/products/demo/bifold-wallet.jpg",
    offerId: "offer-bifold-wallet",
    offerCount: 2,
    amount: 220,
    currencyCode: "ghs",
    categoryLabel: "Fashion & Apparel",
    categoryHandles: ["fashion-apparel", "accessories", "bags"],
    ratingAvg: 4.8,
    ratingCount: 27,
    seller: {
      id: "5e8d3820-f925-4eb0-94a6-94c112526f23",
      name: "Hurry Ventures - Osu",
      handle: "hurry-ventures",
    },
    availableQty: 35,
  },
  {
    id: "prod-cocoa-powder",
    title: "Pure Natural Ghanaian Dark Cocoa Powder 500g",
    description: "100% single-origin premium Ghanaian cocoa powder with rich antioxidant profile and intense chocolate flavor.",
    thumbnail: "/images/products/demo/cocoa-powder.jpg",
    images: [{ url: "/images/products/demo/cocoa-powder.jpg" }],
    thumbUrl: "/images/products/demo/cocoa-powder.jpg",
    offerId: "offer-cocoa-powder",
    offerCount: 3,
    amount: 85,
    currencyCode: "ghs",
    categoryLabel: "Food & Groceries",
    categoryHandles: ["food-groceries", "beverages", "staples"],
    ratingAvg: 4.9,
    ratingCount: 88,
    seller: {
      id: "v-ejs",
      name: "EJ's Mart & Groceries",
      handle: "ejs-cuisine",
    },
    availableQty: 50,
  },
  {
    id: "prod-fast-powerbank",
    title: "Anker 20,000mAh 22.5W Ultra-Fast Power Bank",
    description: "High-capacity portable charger featuring dual USB-C Power Delivery ports and smart digital display.",
    thumbnail: "/images/products/demo/fast-powerbank.jpg",
    images: [{ url: "/images/products/demo/fast-powerbank.jpg" }],
    thumbUrl: "/images/products/demo/fast-powerbank.jpg",
    offerId: "offer-fast-powerbank",
    offerCount: 2,
    amount: 480,
    currencyCode: "ghs",
    categoryLabel: "Phones & Electronics",
    categoryHandles: ["phones-electronics", "accessories"],
    ratingAvg: 4.9,
    ratingCount: 62,
    seller: {
      id: "seller-b",
      name: "Kumasi Tech Hub",
      handle: "kumasi-tech",
    },
    availableQty: 18,
  },
]

export const DEFAULT_STORE_CATEGORIES: StoreCategory[] = [
  { id: "cat-electronics", name: "Phones & Electronics", handle: "phones-electronics" },
  { id: "cat-fashion", name: "Fashion & Apparel", handle: "fashion-apparel" },
  { id: "cat-home", name: "Home & Living", handle: "home-living" },
  { id: "cat-beauty", name: "Health & Beauty", handle: "health-beauty" },
  { id: "cat-baby", name: "Baby & Kids", handle: "baby-kids" },
  { id: "cat-food", name: "Food & Groceries", handle: "food-groceries" },
  { id: "cat-pets", name: "Pet Care", handle: "pet-care" },
]

export async function listPopularProducts(opts?: {
  limit?: number
  window?: "7d" | "30d"
}): Promise<{ products: StoreProductCard[] }> {
  if (!useCloudflareCatalog()) return { products: DEMO_CATALOG_PRODUCTS.slice(0, opts?.limit ?? 8) }
  ensureCloudflareBaseUrl()
  const base = getAlkemartApiUrl()
  const params = new URLSearchParams()
  params.set("limit", String(opts?.limit ?? 12))
  if (opts?.window) params.set("window", opts.window)
  try {
    const res = await fetch(`${base}/store/catalog/popular?${params.toString()}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return { products: DEMO_CATALOG_PRODUCTS.slice(0, opts?.limit ?? 8) }
    const data = (await res.json()) as { items?: unknown[] }
    const mapped = (data.items ?? []).map((item) =>
      mapCfProductCard(item as Parameters<typeof mapCfProductCard>[0]),
    )
    const combined = mapped.length >= 4 ? mapped : [...mapped, ...DEMO_CATALOG_PRODUCTS.filter((d) => !mapped.some((m) => m.id === d.id))]
    return {
      products: combined.slice(0, opts?.limit ?? 8),
    }
  } catch {
    return { products: DEMO_CATALOG_PRODUCTS.slice(0, opts?.limit ?? 8) }
  }
}

export async function listStoreProducts(opts?: {
  limit?: number
  offset?: number
  /** Medusa category id from API, not a display slug invented in UI */
  categoryId?: string
  q?: string
  /** Open seller handle — server catalog filter */
  sellerHandle?: string
  /** Product category handle — server catalog filter */
  categoryHandle?: string
  /** Server-side card ordering (Workers catalog) */
  sort?: "newest" | "price_asc" | "price_desc"
}): Promise<{
  products: StoreProductCard[]
  count: number
}> {
  const limit = opts?.limit ?? 24
  const offset = opts?.offset ?? 0
  const sellerHandle = opts?.sellerHandle?.trim() || undefined
  const categoryHandle = opts?.categoryHandle?.trim() || undefined

  // Cloudflare multivendor catalog — never fall through to Medusa when configured.
  if (useCloudflareCatalog()) {
    const q = opts?.q?.trim() || undefined
    // Workers catalog filters by handle, not Medusa category UUID.
    const cfCategory =
      categoryHandle ||
      (opts?.categoryId?.trim() && !opts.categoryId.includes("-")
        ? opts.categoryId.trim()
        : undefined)
    if (sellerHandle) {
      ensureCloudflareBaseUrl()
      const shop = await getSellerShop(sellerHandle)
      let products = (shop.items ?? []).map(mapCfProductCard)
      if (q) {
        const needle = q.toLowerCase()
        products = products.filter(
          (p) =>
            p.title.toLowerCase().includes(needle) ||
            (p.description?.toLowerCase().includes(needle) ?? false),
        )
      }
      const sliced = products.slice(offset, offset + limit)
      return { products: sliced, count: products.length }
    }
    ensureCloudflareBaseUrl()
    const res = await getCatalog({
      limit,
      offset,
      ...(cfCategory ? { category: cfCategory } : {}),
      ...(q ? { q } : {}),
      ...(opts?.sort ? { sort: opts.sort } : {}),
    })
    const mapped = (res.items ?? []).map(mapCfProductCard)
    const combined = mapped.length >= 4 ? mapped : [...mapped, ...DEMO_CATALOG_PRODUCTS.filter((d) => !mapped.some((m) => m.id === d.id))]
    return {
      products: combined.slice(0, limit),
      count: Math.max(res.total ?? 0, combined.length),
    }
  }

  const sdk = getMedusaClient()
  const { regionId } = commerceContext()

  const useCatalog =
    !opts?.categoryId?.trim() &&
    !opts?.q?.trim() &&
    (offset === 0 || Boolean(sellerHandle || categoryHandle)) &&
    useAlkemartCatalog()

  if (useCatalog) {
    const catalog = await listFromAlkemartCatalog({
      limit,
      offset,
      sellerHandle,
      categoryHandle,
    })
    if (catalog) {
      if (!catalog.products.length) {
        return { products: [], count: catalog.count }
      }
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
            // Preserve catalog taxonomy — product.list may omit categories
             categoryLabel: p.categoryLabel || full.categoryLabel || null,
             categoryHandles: full.categoryHandles || p.categoryHandles || null,
            // Prefer region calculated_price; fall back to catalog min_price
            amount: full.amount ?? p.amount,
            currencyCode: full.currencyCode ?? p.currencyCode,
            createdAt: full.createdAt ?? p.createdAt,
            // Prefer hydrated metadata; fall back to catalog derivatives
            thumbUrl: full.thumbUrl ?? p.thumbUrl,
            webUrl: full.webUrl ?? p.webUrl,
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

  if (useCloudflareCatalog()) {
    ensureCloudflareBaseUrl()
    const detail = await getProduct(key)
    return mapCfDetail(detail)
  }

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
  rank?: number | null
  description?: string | null
  parentCategoryId?: string | null
}

/**
 * Related products: prefer same seller when API provided seller identity.
 * Falls back to other catalog products (same list API). Never invents products.
 */
/**
 * Peer offers for multi-seller comparison (Mowafer "Other Prices / Retailers").
 * Never invents sellers or prices — only API rows with product_id match.
 */
export type PeerOffer = {
  offerId: string
  options?: Record<string, string>
  productId?: string | null
  seller: SellerRef
  amount?: number | null
  currencyCode?: string | null
}

export async function listPeerOffersForProduct(
  productId: string,
): Promise<PeerOffer[]> {
  const pid = productId.trim()
  if (!pid) return []

  if (useCloudflareCatalog()) {
    try {
      ensureCloudflareBaseUrl()
      const detail = await getProduct(pid)
      return (detail.offers ?? []).map((o) => mapCfPeer(o, pid))
    } catch {
      return []
    }
  }

  try {
    const base = getBackendUrl()
    const pk = getPublishableKey()
    // Server-scoped peer list (not client filter of global /store/offers)
    const res = await fetch(
      `${base}/store/alkemart/offers?product_id=${encodeURIComponent(pid)}&limit=20`,
      {
        headers: {
          Accept: "application/json",
          "x-publishable-api-key": pk,
        },
      },
    )
    if (!res.ok) return []
    const data = (await res.json()) as {
      offers?: {
        id?: string
        offer_id?: string
        product_id?: string
        amount?: number | null
        currency_code?: string | null
        seller?: { id?: string; name?: string; handle?: string } | null
      }[]
    }
    const out: PeerOffer[] = []
    for (const o of data.offers ?? []) {
      const offerId = o.offer_id || o.id
      if (!offerId) continue
      const name = o.seller?.name?.trim()
      if (!name) continue
      out.push({
        offerId,
        productId: o.product_id ?? pid,
        seller: {
          id: o.seller?.id ?? null,
          name,
          handle: o.seller?.handle ?? null,
        },
        amount: o.amount != null ? Number(o.amount) : null,
        currencyCode: o.currency_code ?? null,
      })
    }
    return out
  } catch {
    return []
  }
}

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
/**
 * Fetch featured products from the storefront API.
 */
export async function fetchFeaturedProducts(): Promise<StoreProductCard[]> {
  const previewFallback = () =>
    import.meta.env.DEV ? DEMO_CATALOG_PRODUCTS.slice(0, 36) : []

  if (useCloudflareCatalog()) {
    try {
      // Honest curation: newest real listings first (no invented "trending").
      const { products } = await listStoreProducts({ limit: 36, offset: 0, sort: "newest" })
      return products.length > 0 ? products : previewFallback()
    } catch {
      return []
    }
  }
  try {
    const base = getBackendUrl()
    const pk = getPublishableKey()
    const res = await fetch(`${base}/store/featured-products`, {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": pk,
      },
    })
    if (!res.ok) {
      const { products } = await listStoreProducts({ limit: 36, offset: 0 })
      return products.length > 0 ? products : previewFallback()
    }
    const data = (await res.json()) as { products?: ProductSlice[] }
    const raw = (data.products ?? []) as ProductSlice[]
    const featured = raw.map((p) => mapProduct(p))
    if (featured.length > 0) return featured
    const { products } = await listStoreProducts({ limit: 36, offset: 0 })
    return products.length > 0 ? products : previewFallback()
  } catch {
    try {
      const { products } = await listStoreProducts({ limit: 36, offset: 0 })
      return products.length > 0 ? products : previewFallback()
    } catch {
      return previewFallback()
    }
  }
}

function flattenCategoryTree(
  nodes: Array<{
    id: string
    handle: string
    name: string
    parentId?: string | null
    children?: unknown[]
  }>,
  rankBase = 0,
): StoreCategory[] {
  const out: StoreCategory[] = []
  nodes.forEach((n, i) => {
    out.push({
      id: n.id,
      name: n.name,
      handle: n.handle,
      rank: rankBase + i,
      parentCategoryId: n.parentId ?? null,
    })
    const kids = (n.children ?? []) as typeof nodes
    if (kids.length) out.push(...flattenCategoryTree(kids, rankBase + i * 100))
  })
  return out
}

export async function listStoreCategories(): Promise<StoreCategory[]> {
  if (useCloudflareCatalog()) {
    try {
      ensureCloudflareBaseUrl()
      const res = await getCategories()
      return flattenCategoryTree(res.categories ?? [])
    } catch {
      return []
    }
  }

  const sdk = getMedusaClient()
  try {
    const res = await sdk.store.category.list({ limit: 50 })
    const cats = (res as unknown as {
      product_categories: {
        id: string
        name?: string
        handle?: string
        rank?: number
        description?: string
        parent_category_id?: string | null
      }[]
    }).product_categories ?? []
    return cats
      .filter((c) => c?.id && c?.name)
      .map((c) => ({
        id: c.id,
        name: c.name!,
        handle: c.handle ?? null,
        rank: c.rank ?? null,
        description: c.description ?? null,
        parentCategoryId: c.parent_category_id ?? null,
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
      product_categories?: {
        id: string
        name?: string
        handle?: string
        rank?: number
        description?: string
        parent_category_id?: string | null
      }[]
    }
    return (data.product_categories ?? [])
      .filter((c) => c?.id && c?.name)
      .map((c) => ({
        id: c.id,
        name: c.name!,
        handle: c.handle ?? null,
        rank: c.rank ?? null,
        description: c.description ?? null,
        parentCategoryId: c.parent_category_id ?? null,
      }))
  }
}
