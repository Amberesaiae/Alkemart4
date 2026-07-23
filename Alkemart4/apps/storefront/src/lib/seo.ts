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
}): Record<string, unknown> {
  const url = absoluteUrl(p.path)
  const desc = p.description
    ? truncateMeta(stripHtml(p.description), 300)
    : undefined

  const offers: Record<string, unknown> | undefined =
    p.amount != null && p.currencyCode
      ? {
          "@type": "Offer",
          price: p.amount,
          priceCurrency: p.currencyCode.toUpperCase(),
          availability: "https://schema.org/InStock",
          url,
        }
      : undefined

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: desc,
    image: p.thumbnail ? [p.thumbnail] : undefined,
    sku: p.id,
    url,
    brand: p.sellerName
      ? { "@type": "Brand", name: p.sellerName }
      : { "@type": "Brand", name: SITE },
    offers,
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

export function storeJsonLd(s: {
  name: string
  description?: string | null
  path: string
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: s.name,
    description: s.description
      ? truncateMeta(stripHtml(s.description), 300)
      : undefined,
    url: absoluteUrl(s.path),
  }
}
