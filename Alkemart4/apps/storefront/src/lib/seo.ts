/**
 * SPA SEO hygiene — titles, meta, JSON-LD from real API data only.
 * @see docs/architecture/2026-07-17-data-search-seo-ghana-adaptation-plan.md §5
 */

const SITE = "alkemart"
const DEFAULT_DESC =
  "alkemart — multi-vendor marketplace. Compare prices, shop with cash on delivery."

export function siteName(): string {
  return SITE
}

export function defaultDescription(): string {
  return DEFAULT_DESC
}

/** Absolute origin for canonical/OG when VITE_PUBLIC_SITE_URL is set. */
export function siteOrigin(): string {
  const env = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim()
  if (env) return env.replace(/\/$/, "")
  if (typeof window !== "undefined") return window.location.origin
  return ""
}

export function absoluteUrl(path: string): string {
  const origin = siteOrigin()
  if (!path.startsWith("/")) path = `/${path}`
  return origin ? `${origin}${path}` : path
}

export function truncateMeta(text: string, max = 155): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function setDocumentTitle(pageTitle: string): void {
  if (typeof document === "undefined") return
  const t = pageTitle.trim()
  document.title = t ? `${t} · ${SITE}` : SITE
}

function upsertMeta(
  attr: "name" | "property",
  key: string,
  content: string | null | undefined,
): void {
  if (typeof document === "undefined") return
  const selector = `meta[${attr}="${key}"]`
  let el = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!content?.trim()) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content.trim()
}

function upsertLink(rel: string, href: string | null | undefined): void {
  if (typeof document === "undefined") return
  const selector = `link[rel="${rel}"]`
  let el = document.head.querySelector(selector) as HTMLLinkElement | null
  if (!href?.trim()) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement("link")
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href.trim()
}

export type PageSeo = {
  title: string
  description?: string | null
  path?: string
  image?: string | null
  /** When true, robots = noindex,follow (facet combos, account, cart) */
  noindex?: boolean
  type?: "website" | "product"
}

/** Apply title + description + OG/Twitter + canonical + robots for a view. */
export function applyPageSeo(seo: PageSeo): void {
  setDocumentTitle(seo.title)
  const desc = truncateMeta(seo.description?.trim() || DEFAULT_DESC)
  const url = seo.path ? absoluteUrl(seo.path) : undefined
  const image = seo.image?.trim() || undefined

  upsertMeta("name", "description", desc)
  upsertMeta("name", "robots", seo.noindex ? "noindex, follow" : "index, follow")

  upsertMeta("property", "og:site_name", SITE)
  upsertMeta("property", "og:title", `${seo.title.trim()} · ${SITE}`)
  upsertMeta("property", "og:description", desc)
  upsertMeta("property", "og:type", seo.type ?? "website")
  if (url) upsertMeta("property", "og:url", url)
  if (image) upsertMeta("property", "og:image", image)

  upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary")
  upsertMeta("name", "twitter:title", `${seo.title.trim()} · ${SITE}`)
  upsertMeta("name", "twitter:description", desc)

  upsertLink("canonical", url ?? null)
}

const JSON_LD_ID = "alkemart-jsonld"

export function setJsonLd(data: Record<string, unknown> | null): void {
  if (typeof document === "undefined") return
  let el = document.getElementById(JSON_LD_ID) as HTMLScriptElement | null
  if (!data) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement("script")
    el.id = JSON_LD_ID
    el.type = "application/ld+json"
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

export function organizationJsonLd(): Record<string, unknown> {
  const url = siteOrigin() || undefined
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE,
    url,
    description: DEFAULT_DESC,
  }
}

export type SeoOffer = {
  price: number
  currencyCode: string
  sellerName?: string | null
  /** Machine availability; unknown reads as InStock-never — omit instead. */
  inStock?: boolean | null
  /** Delivery fee in major units when the seller declares one. */
  deliveryFee?: number | null
  url?: string | null
}

export type SeoVariant = {
  name: string
  url?: string | null
  image?: string | null
}

export type SeoRating = {
  avg: number
  count: number
}

function offerNode(
  o: SeoOffer,
  fallbackUrl: string | undefined,
): Record<string, unknown> {
  return {
    "@type": "Offer",
    price: o.price,
    priceCurrency: o.currencyCode.toUpperCase(),
    availability:
      o.inStock === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    url: o.url ?? fallbackUrl,
    // Seller identity belongs to the offer, never to Brand.
    ...(o.sellerName?.trim()
      ? { seller: { "@type": "Organization", name: o.sellerName.trim() } }
      : {}),
    ...(o.deliveryFee != null && o.deliveryFee >= 0
      ? {
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingRate: {
              "@type": "MonetaryAmount",
              value: o.deliveryFee,
              currency: o.currencyCode.toUpperCase(),
            },
          },
        }
      : {}),
  }
}

/**
 * Product JSON-LD from real API data only (blueprint Doc 08 + Phase 6A).
 *
 * - Brand is the manufacturer/product brand. Omitted when unknown — never
 *   the seller, never the marketplace.
 * - Multiple sellable offers collapse to an AggregateOffer (low/high/count)
 *   with per-seller Offer nodes; a single offer renders as one Offer.
 * - aggregateRating renders only with verified reviews on record (count > 0).
 * - Variants render as a ProductGroup with hasVariant entries; offers stay
 *   at the level they were measured (group aggregate, never per-variant
 *   prices we did not verify).
 * - Returns policy has no structured source (warranty/returns refs are free
 *   text), so no MerchantReturnPolicy block is emitted rather than a
 *   fabricated one.
 */
export function productJsonLd(p: {
  id: string
  title: string
  description?: string | null
  handle?: string | null
  thumbnail?: string | null
  amount?: number | null
  currencyCode?: string | null
  path: string
  sellerName?: string | null
  /** True manufacturer/product brand (Phase 1 `products.brand`). Omit when unknown. */
  brandName?: string | null
  /** Sellable offers across sellers; replaces amount/sellerName when given. */
  offers?: SeoOffer[] | null
  /** Combination variants for ProductGroup output. */
  variants?: SeoVariant[] | null
  /** Verified-review aggregate; omitted unless count > 0. */
  rating?: SeoRating | null
}): Record<string, unknown> {
  const url = absoluteUrl(p.path)
  const desc = p.description
    ? truncateMeta(stripHtml(p.description), 300)
    : undefined

  const brand = p.brandName?.trim() || undefined

  const explicit = (p.offers ?? []).filter(
    (o) => o.price != null && Number.isFinite(o.price) && o.currencyCode,
  )
  const legacy =
    explicit.length === 0 && p.amount != null && p.currencyCode
      ? [
          {
            price: p.amount,
            currencyCode: p.currencyCode,
            sellerName: p.sellerName ?? null,
          },
        ]
      : []
  const offers = [...explicit, ...legacy]

  const offerBlock: Record<string, unknown> | undefined =
    offers.length === 0
      ? undefined
      : offers.length === 1
        ? offerNode(offers[0] as SeoOffer, url)
        : {
            "@type": "AggregateOffer",
            lowPrice: Math.min(...offers.map((o) => o.price)),
            highPrice: Math.max(...offers.map((o) => o.price)),
            offerCount: offers.length,
            priceCurrency: offers[0]!.currencyCode.toUpperCase(),
            offers: offers.map((o) => offerNode(o, url)),
          }

  const rating =
    p.rating && p.rating.count > 0 && p.rating.avg > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: p.rating.avg,
          reviewCount: p.rating.count,
        }
      : undefined

  const base = {
    name: p.title,
    description: desc,
    image: p.thumbnail ? [p.thumbnail] : undefined,
    sku: p.id,
    url,
    // Brand is the manufacturer/product brand only. Omitted when unknown —
    // never the seller, never the marketplace fallback (blueprint Doc 08).
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(offerBlock ? { offers: offerBlock } : {}),
    ...(rating ? { aggregateRating: rating } : {}),
  }

  const variants = (p.variants ?? []).filter((v) => v.name?.trim())
  if (variants.length === 0) {
    return { "@context": "https://schema.org", "@type": "Product", ...base }
  }
  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    ...base,
    hasVariant: variants.map((v) => ({
      "@type": "Product",
      name: v.name.trim(),
      url: v.url ?? url,
      ...(v.image ? { image: [v.image] } : {}),
    })),
  }
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  }
}

/**
 * Category listing JSON-LD (Phase 6A): a CollectionPage naming the items
 * actually rendered (capped). No ratings, prices, or availability here —
 * those belong to the product pages this list links to.
 */
export function itemListJsonLd(list: {
  name: string
  description?: string | null
  path: string
  items: { name: string; path: string }[]
}): Record<string, unknown> {
  const entries = list.items
    .filter((it) => it.name?.trim() && it.path?.trim())
    .slice(0, 50)
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: list.name,
    description: list.description
      ? truncateMeta(stripHtml(list.description), 300)
      : undefined,
    url: absoluteUrl(list.path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entries.length,
      itemListElement: entries.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name.trim(),
        url: absoluteUrl(it.path),
      })),
    },
  }
}

export function storeJsonLd(s: {
  name: string
  description?: string | null
  path: string
  /** Shop region (e.g. "Greater Accra"); omitted when unknown. */
  location?: string | null
}): Record<string, unknown> {
  const location = s.location?.trim() || undefined
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: s.name,
    description: s.description
      ? truncateMeta(stripHtml(s.description), 300)
      : undefined,
    url: absoluteUrl(s.path),
    ...(location ? { areaServed: location } : {}),
  }
}
