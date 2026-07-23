/**
 * Post-build PDP HTML shells for crawlers (SPA hydrate still required for full app).
 *
 * Usage (after `bun run build`):
 *   VITE_MEDUSA_BACKEND_URL=… VITE_MEDUSA_PUBLISHABLE_KEY=… \
 *   VITE_PUBLIC_SITE_URL=https://shop.example.com \
 *   node scripts/prerender-pdp.mjs
 *
 * Fetches GET /store/sitemap?format=json and writes dist/product/<handle>/index.html
 * with product title, description, canonical, and Product JSON-LD from store API.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const dist = path.join(root, "dist")

const backend = (process.env.VITE_MEDUSA_BACKEND_URL || "").replace(/\/$/, "")
const pk = process.env.VITE_MEDUSA_PUBLISHABLE_KEY || ""
const site = (process.env.VITE_PUBLIC_SITE_URL || "http://localhost:5175").replace(
  /\/$/,
  "",
)
const region = process.env.VITE_MEDUSA_REGION_ID || ""

function esc(s) {
  return String(s)
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
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

async function main() {
  if (!fs.existsSync(dist)) {
    console.error("dist/ missing — run bun run build first")
    process.exit(1)
  }
  if (!backend || !pk) {
    console.error("Need VITE_MEDUSA_BACKEND_URL and VITE_MEDUSA_PUBLISHABLE_KEY")
    process.exit(1)
  }

  const shellPath = path.join(dist, "index.html")
  const shell = fs.readFileSync(shellPath, "utf8")

  const smRes = await fetch(
    `${backend}/store/sitemap?format=json&base=${encodeURIComponent(site)}`,
    { headers: { "x-publishable-api-key": pk, Accept: "application/json" } },
  )
  if (!smRes.ok) {
    console.error("sitemap fetch failed", smRes.status)
    process.exit(1)
  }
  const sm = await smRes.json()
  const productUrls = (sm.urls || []).filter((u) =>
    String(u.loc || "").includes("/product/"),
  )

  let written = 0
  for (const u of productUrls) {
    const loc = String(u.loc)
    const handle = decodeURIComponent(loc.split("/product/").pop() || "").replace(
      /\/$/,
      "",
    )
    if (!handle) continue

    const q = new URLSearchParams({ limit: "1", handle })
    if (region) q.set("region_id", region)
    q.set(
      "fields",
      "*variants.calculated_price,*variants,description,thumbnail,title,handle",
    )

    const pRes = await fetch(`${backend}/store/products?${q}`, {
      headers: { "x-publishable-api-key": pk, Accept: "application/json" },
    })
    if (!pRes.ok) {
      console.warn("skip product", handle, pRes.status)
      continue
    }
    const body = await pRes.json()
    const p = (body.products || [])[0]
    if (!p?.id) {
      console.warn("no product", handle)
      continue
    }

    const title = p.title || handle
    const desc = truncate(
      stripHtml(p.description) || `${title} on alkemart`,
    )
    const pathUrl = `${site}/product/${encodeURIComponent(handle)}`
    const variant = (p.variants || [])[0]
    const price = variant?.calculated_price?.calculated_amount
    const currency = variant?.calculated_price?.currency_code || "ghs"

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: title,
      description: desc,
      url: pathUrl,
      image: p.thumbnail ? [p.thumbnail] : undefined,
      offers:
        price != null
          ? {
              "@type": "Offer",
              price: Number(price),
              priceCurrency: String(currency).toUpperCase(),
              availability: "https://schema.org/InStock",
              url: pathUrl,
            }
          : undefined,
    }

    let html = shell
    html = html.replace(
      /<title>[^<]*<\/title>/i,
      `<title>${esc(title)} · alkemart</title>`,
    )
    if (html.includes('name="description"')) {
      html = html.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${esc(desc)}" />`,
      )
    } else {
      html = html.replace(
        "</head>",
        `  <meta name="description" content="${esc(desc)}" />\n  </head>`,
      )
    }
    const headBits = `
  <link rel="canonical" href="${esc(pathUrl)}" />
  <meta property="og:title" content="${esc(title)} · alkemart" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:type" content="product" />
  <meta property="og:url" content="${esc(pathUrl)}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
`
    html = html.replace("</head>", `${headBits}</head>`)
    // Noscript fallback for crawlers that skip JS
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root"></div>
  <noscript>
    <article>
      <h1>${esc(title)}</h1>
      <p>${esc(desc)}</p>
      <p><a href="${esc(pathUrl)}">View on alkemart</a></p>
    </article>
  </noscript>`,
    )

    const outDir = path.join(dist, "product", handle)
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, "index.html"), html)
    written += 1
    console.log("prerendered", handle)
  }

  console.log(`Done: ${written} PDP shells under dist/product/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
