/**
 * Deterministic HTML shells + sitemaps + merchant feed for crawlers
 * (ADR-006, Phase 6B/6C/6D). The storefront is a Vite SPA; this post-build
 * step emits indexable shells with title/meta/canonical/JSON-LD in the
 * initial HTML, segmented sitemap XML, and dist/feed.xml.
 *
 * Usage (after `bun run build`):
 *   VITE_ALKEMART_API_URL=https://api.example.com \
 *   VITE_PUBLIC_SITE_URL=https://shop.example.com \
 *   node scripts/prerender-pdp.mjs
 *
 * Sources: GET /store/sitemap (live indexable truth) plus the same public
 * store endpoints the SPA reads — feed and shells can never disagree with
 * buyer-visible data. Unknown/missing rows are skipped, never fabricated.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const dist = path.join(root, "dist")

const api = (process.env.VITE_ALKEMART_API_URL || "").replace(/\/$/, "")
const site = (process.env.VITE_PUBLIC_SITE_URL || "").replace(/\/$/, "")

/** Static shell routes bundled with the SPA (no API data needed). */
const STATIC_URLS = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/about", changefreq: "monthly", priority: "0.8" },
  { loc: "/contact", changefreq: "monthly", priority: "0.8" },
  { loc: "/categories/all", changefreq: "daily", priority: "0.9" },
  { loc: "/shops", changefreq: "weekly", priority: "0.7" },
  { loc: "/delivery", changefreq: "monthly", priority: "0.5" },
  { loc: "/help", changefreq: "monthly", priority: "0.5" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
]

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function truncate(t, max = 155) {
  const s = String(t || "")
  if (s.length <= max) return s
  return `${s.slice(0, max - 1).trimEnd()}…`
}

/** Pesewas string → "1234.56" without float drift. */
function majorFixed(pesewas) {
  try {
    const n = BigInt(pesewas)
    const neg = n < 0n
    const abs = neg ? -n : n
    const out = `${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`
    return neg ? `-${out}` : out
  } catch {
    return null
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

function injectHead(shell, { title, desc, canonical, ogType = "website", image, jsonLd, noindex = false }) {
  let html = shell.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${esc(title)} · alkemart</title>`,
  )
  // The shell ships generic tags baked at build time; a shell with two
  // canonicals (or two og:titles) is invalid, so strip ours first.
  html = html.replace(/<link\s+rel="canonical"[^>]*>/gi, "")
  html = html.replace(/<meta\s+name="robots"[^>]*>/gi, "")
  html = html.replace(/<meta\s+property="og:(title|description|type|url|image|site_name)"[^>]*>/gi, "")
  html = html.replace(/<meta\s+name="twitter:(card|title|description)"[^>]*>/gi, "")
  html = html.replace(/<script\s+type="application\/ld\+json">.*?<\/script>/gis, "")
  const descTag = `<meta name="description" content="${esc(desc)}" />`
  if (/<meta\s+name="description"/i.test(html)) {
    html = html.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      descTag,
    )
  } else {
    html = html.replace("</head>", `  ${descTag}\n  </head>`)
  }
  const bits = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta name="robots" content="${noindex ? "noindex, follow" : "index, follow"}" />`,
    `<meta property="og:title" content="${esc(title)} · alkemart" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:type" content="${esc(ogType)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
  ]
  if (image) bits.push(`<meta property="og:image" content="${esc(image)}" />`)
  if (jsonLd) bits.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`)
  return html.replace("</head>", `  ${bits.join("\n  ")}\n  </head>`)
}

function withNoscript(shell, { title, desc, url }) {
  return shell.replace(
    '<div id="root"></div>',
    `<div id="root"></div>
  <noscript>
    <article>
      <h1>${esc(title)}</h1>
      <p>${esc(desc)}</p>
      <p><a href="${esc(url)}">View on alkemart</a></p>
    </article>
  </noscript>`,
  )
}

function writeShell(segments, html) {
  const outDir = path.join(dist, ...segments)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, "index.html"), html)
}

async function main() {
  if (!fs.existsSync(dist)) {
    console.error("dist/ missing — run bun run build first")
    process.exit(1)
  }
  if (!api) {
    console.error("Need VITE_ALKEMART_API_URL")
    process.exit(1)
  }
  if (!site) {
    console.error("Need VITE_PUBLIC_SITE_URL")
    process.exit(1)
  }
  if (/localhost|127\.0\.0\.1/.test(site)) {
    console.error(`Refusing to emit production canonicals for ${site}`)
    process.exit(1)
  }
  if (!site.startsWith("https://")) {
    console.error(`Canonical origin must be https, got ${site}`)
    process.exit(1)
  }

  const shell = fs.readFileSync(path.join(dist, "index.html"), "utf8")
  const sm = await fetchJson(`${api}/store/sitemap`).catch((e) => {
    console.error("sitemap fetch failed:", e.message)
    process.exit(1)
  })
  const urls = Array.isArray(sm.urls) ? sm.urls : []
  console.log(`sitemap: ${urls.length} indexable urls`)

  let shells = 0
  const byType = { product: [], category: [], shop: [], collection: [] }
  for (const u of urls) {
    if (u && typeof u.path === "string" && byType[u.type]) byType[u.type].push(u)
  }

  // ── Products: full meta + Product/AggregateOffer JSON-LD ──
  for (const u of byType.product) {
    const id = u.path.split("/product/").pop() || ""
    if (!id) continue
    try {
      const detail = await fetchJson(`${api}/store/products/${encodeURIComponent(id)}`)
      const title = detail.title || id
      const desc = truncate(stripHtml(detail.description) || `${title} on alkemart`)
      const canonical = `${site}/product/${encodeURIComponent(id)}`
      const image = Array.isArray(detail.imageUrls) ? detail.imageUrls[0] ?? null : null
      const offers = Array.isArray(detail.offers) ? detail.offers : []
      const priced = offers.filter((o) => o.pricePesewas != null)
      const offerNodes = priced.map((o) => ({
        "@type": "Offer",
        price: Number(o.pricePesewas) / 100,
        priceCurrency: "GHS",
        availability: "https://schema.org/InStock",
        url: canonical,
        ...(o.sellerName ? { seller: { "@type": "Organization", name: o.sellerName } } : {}),
      }))
      const offersLd =
        offerNodes.length === 0
          ? undefined
          : offerNodes.length === 1
            ? offerNodes[0]
            : {
                "@type": "AggregateOffer",
                lowPrice: Math.min(...priced.map((o) => Number(o.pricePesewas) / 100)),
                highPrice: Math.max(...priced.map((o) => Number(o.pricePesewas) / 100)),
                offerCount: offerNodes.length,
                priceCurrency: "GHS",
                offers: offerNodes,
              }
      const identity = detail.identity || {}
      const reviews = Array.isArray(detail.reviews) ? detail.reviews : []
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: title,
        description: desc,
        url: canonical,
        ...(image ? { image: [image] } : {}),
        sku: id,
        ...(identity.brand
          ? { brand: { "@type": "Brand", name: identity.brand } }
          : {}),
        ...(offersLd ? { offers: offersLd } : {}),
        ...(reviews.length > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue:
                  Math.round(
                    (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10,
                  ) / 10,
                reviewCount: reviews.length,
              },
            }
          : {}),
      }
      const html = withNoscript(
        injectHead(shell, {
          title,
          desc,
          canonical,
          ogType: "product",
          image,
          jsonLd,
        }),
        { title, desc, url: canonical },
      )
      writeShell(["product", id], html)
      shells += 1
    } catch (e) {
      console.warn("skip product", id, e.message)
    }
  }

  // ── Categories: CollectionPage + ItemList from live cards ──
  let categories = []
  try {
    const cat = await fetchJson(`${api}/store/categories`)
    categories = Array.isArray(cat) ? cat : cat.categories || cat.nodes || []
  } catch (e) {
    console.warn("categories unavailable:", e.message)
  }
  const catByHandle = new Map(
    categories.map((c) => [
      c.handle,
      { handle: c.handle, name: c.displayName || c.canonicalName || c.name || c.handle },
    ]),
  )
  for (const u of byType.category) {
    const handle = u.path.split("/categories/").pop() || ""
    if (!handle) continue
    try {
      const node = catByHandle.get(handle)
      const name = node?.name || handle
      const desc = `Browse ${name} on alkemart — compare multi-seller offers.`
      const canonical = `${site}/categories/${encodeURIComponent(handle)}`
      let items = []
      try {
        const list = await fetchJson(
          `${api}/store/catalog?category=${encodeURIComponent(handle)}&limit=20`,
        )
        items = (Array.isArray(list.items) ? list.items : []).slice(0, 20).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.title,
          url: `${site}/product/${encodeURIComponent(c.slug ? `${c.slug}-${c.productId}` : c.productId)}`,
        }))
      } catch (e) {
        console.warn("category cards unavailable:", handle, e.message)
      }
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name,
        description: desc,
        url: canonical,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: items.length,
          itemListElement: items,
        },
      }
      const html = withNoscript(
        injectHead(shell, { title: name, desc, canonical, jsonLd }),
        { title: name, desc, url: canonical },
      )
      writeShell(["categories", handle], html)
      shells += 1
    } catch (e) {
      console.warn("skip category", handle, e.message)
    }
  }

  // ── Shops: Store + areaServed, only when the shop resolves ──
  for (const u of byType.shop) {
    const handle = u.path.split("/shops/").pop() || ""
    if (!handle) continue
    try {
      const shop = await fetchJson(`${api}/store/sellers/${encodeURIComponent(handle)}`)
      const seller = shop.seller || {}
      const name = seller.name || handle
      const desc = truncate(stripHtml(seller.description) || `Shop ${name} on alkemart`)
      const canonical = `${site}/shops/${encodeURIComponent(handle)}`
      const trust = seller.trust || {}
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Store",
        name,
        description: desc,
        url: canonical,
        ...(trust.location ? { areaServed: trust.location } : {}),
      }
      const html = withNoscript(
        injectHead(shell, { title: name, desc, canonical, jsonLd }),
        { title: name, desc, url: canonical },
      )
      writeShell(["shops", handle], html)
      shells += 1
    } catch (e) {
      console.warn("skip shop", handle, e.message)
    }
  }

  // ── Collections: CollectionPage + ItemList via seller resolution ──
  for (const u of byType.collection) {
    const m = u.path.match(/^\/shops\/collections\/([^?]+)\?shop=(.+)$/)
    if (!m) continue
    const [, cid, shopHandle] = m
    try {
      const shop = await fetchJson(`${api}/store/sellers/${encodeURIComponent(shopHandle)}`)
      const sellerId = shop?.seller?.id
      if (!sellerId) continue
      const shelf = await fetchJson(
        `${api}/store/collections/${encodeURIComponent(cid)}?seller_id=${encodeURIComponent(sellerId)}`,
      )
      const col = shelf.collection || {}
      const cards = Array.isArray(shelf.cards) ? shelf.cards : []
      const name = col.name || "Shelf"
      const desc = truncate(stripHtml(col.description) || `${name} — a shelf by ${shop?.seller?.name || "a seller"} on alkemart`)
      const canonical = `${site}/shops/collections/${encodeURIComponent(cid)}?shop=${encodeURIComponent(shopHandle)}`
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name,
        description: desc,
        url: canonical,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: cards.length,
          itemListElement: cards.slice(0, 20).map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.title,
            url: `${site}/product/${encodeURIComponent(c.slug ? `${c.slug}-${c.productId}` : c.productId)}`,
          })),
        },
      }
      const html = withNoscript(
        injectHead(shell, { title: `${name} · ${shop?.seller?.name || ""}`.trim(), desc, canonical, jsonLd }),
        { title: name, desc, url: canonical },
      )
      writeShell(["shops", "collections", cid], html)
      shells += 1
    } catch (e) {
      console.warn("skip collection", cid, e.message)
    }
  }

  // ── Segmented sitemaps + index (absolute locs only) ──
  const abs = (p) => `${site}${String(p).startsWith("/") ? p : `/${p}`}`
  const seg = (name, list) => {
    const file = `sitemap-${name}.xml`
    fs.writeFileSync(
      path.join(dist, file),
      sitemapXml(list.map((u) => ({ ...u, loc: abs(u.loc ?? u.path) }))),
    )
    return file
  }
  const files = [
    seg("products", byType.product.map((u) => ({ loc: u.path, lastmod: u.updatedAt ?? undefined }))),
    seg("categories", byType.category.map((u) => ({ loc: u.path }))),
    seg("shops", byType.shop.map((u) => ({ loc: u.path }))),
    seg("collections", byType.collection.map((u) => ({ loc: u.path }))),
    seg("static", STATIC_URLS),
  ]
  const index = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files
    .map((f) => `  <sitemap>\n    <loc>${esc(`${site}/${f}`)}</loc>\n  </sitemap>`)
    .join("\n")}\n</sitemapindex>\n`
  fs.writeFileSync(path.join(dist, "sitemap.xml"), index)

  // ── Merchant feed (absolute links; unknown facts omitted, never invented) ──
  const feed = await fetchJson(`${api}/store/feed?limit=500`).catch((e) => {
    console.warn("feed unavailable:", e.message)
    return null
  })
  if (feed && Array.isArray(feed.items)) {
    const items = feed.items
      .map((r) => {
        if (!r.productId || !r.title || r.pricePesewas == null) return null
        const price = majorFixed(r.pricePesewas)
        if (!price) return null
        const lines = [
          `    <item>`,
          `      <g:id>${esc(r.productId)}</g:id>`,
          `      <title>${esc(r.title)}</title>`,
          ...(r.description ? [`      <description>${esc(stripHtml(r.description).slice(0, 5000))}</description>`] : []),
          `      <link>${esc(`${site}/product/${encodeURIComponent(r.slug ? `${r.slug}-${r.productId}` : r.productId)}`)}</link>`,
          ...(r.imageUrl ? [`      <g:image_link>${esc(r.imageUrl)}</g:image_link>`] : []),
          `      <g:price>${price} GHS</g:price>`,
          `      <g:availability>${r.inStock ? "in_stock" : "out_of_stock"}</g:availability>`,
          ...(r.condition ? [`      <g:condition>${esc(r.condition)}</g:condition>`] : []),
          ...(r.brand ? [`      <g:brand>${esc(r.brand)}</g:brand>`] : []),
          ...(r.gtin ? [`      <g:gtin>${esc(r.gtin)}</g:gtin>`] : []),
          ...(r.mpn ? [`      <g:mpn>${esc(r.mpn)}</g:mpn>`] : []),
          `      <g:product_type>${esc(r.categoryName || r.categoryHandle || "General")}</g:product_type>`,
          `      <g:shipping>`,
          `        <g:country>GH</g:country>`,
          `        <g:service>Standard</g:service>`,
          `        <g:price>${majorFixed(r.deliveryFeePesewas ?? "0") || "0.00"} GHS</g:price>`,
          `      </g:shipping>`,
          `    </item>`,
        ]
        return lines.join("\n")
      })
      .filter(Boolean)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>alkemart</title>\n    <link>${esc(site)}</link>\n    <description>alkemart marketplace product feed</description>\n${items.join("\n")}\n  </channel>\n</rss>\n`
    fs.writeFileSync(path.join(dist, "feed.xml"), xml)
    console.log(`feed: ${items.length} items → dist/feed.xml`)
  }

  console.log(`Done: ${shells} shells, sitemaps [${files.join(", ")}] under dist/`)
}

function sitemapXml(urls) {
  const rows = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${esc(u.loc)}</loc>` +
        (u.lastmod ? `\n    <lastmod>${esc(u.lastmod)}</lastmod>` : "") +
        (u.changefreq ? `\n    <changefreq>${esc(u.changefreq)}</changefreq>` : "") +
        (u.priority ? `\n    <priority>${esc(u.priority)}</priority>` : "") +
        `\n  </url>`,
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
