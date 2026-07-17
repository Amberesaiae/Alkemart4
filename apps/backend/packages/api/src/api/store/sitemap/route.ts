/**
 * GET /store/sitemap — dynamic URL list for SEO.
 * Query: ?format=xml|json (default xml), optional SITE_URL / ?base=
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { listPublishedSitemapEntries } from "../../../lib/search/service"

const STATIC_PATHS = [
  "/",
  "/browse/all",
  "/search",
  "/sellers",
  "/sell",
  "/partners",
  "/help",
]

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function resolveBase(req: MedusaRequest): string {
  const q = typeof req.query?.base === "string" ? req.query.base.trim() : ""
  if (q) return q.replace(/\/$/, "")
  const env = process.env.STOREFRONT_URL?.trim() || process.env.SITE_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  // Dev default for absolute loc when unset
  return "http://localhost:5175"
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: (args: unknown) => Promise<{ data: unknown }>
  }

  let products: { handle: string; id: string; updated_at?: string }[] = []
  try {
    products = await listPublishedSitemapEntries(query)
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Failed to list products",
    })
    return
  }

  const base = resolveBase(req)
  const format =
    typeof req.query?.format === "string"
      ? req.query.format.toLowerCase()
      : "xml"

  const urls: {
    loc: string
    changefreq: string
    priority: string
    lastmod?: string
  }[] = [
    ...STATIC_PATHS.map((p) => ({
      loc: `${base}${p === "/" ? "/" : p}`,
      changefreq: p === "/" || p.startsWith("/browse") ? "daily" : "weekly",
      priority: p === "/" ? "1.0" : "0.7",
    })),
    ...products.map((p) => ({
      loc: `${base}/product/${encodeURIComponent(p.handle)}`,
      changefreq: "daily",
      priority: "0.8",
      lastmod: p.updated_at
        ? new Date(p.updated_at).toISOString().slice(0, 10)
        : undefined,
    })),
  ]

  if (format === "json") {
    res.status(200).json({
      base,
      count: urls.length,
      products: products.length,
      urls,
    })
    return
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const last = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""
    return `  <url>
    <loc>${escapeXml(u.loc)}</loc>${last}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  })
  .join("\n")}
</urlset>
`

  res.setHeader("Content-Type", "application/xml; charset=utf-8")
  res.setHeader("Cache-Control", "public, max-age=300")
  res.status(200).send(body)
}
