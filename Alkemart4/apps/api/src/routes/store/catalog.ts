import { Hono } from "hono"
import type { ApiEnv } from "../../env"
import type { AppEnv } from "../../context"
import { edgeCache } from "../../lib/edge-cache"
import type { CatalogListQuery, CatalogSort } from "../../catalog-repository"

const CATALOG_KV_TTL_SECONDS = 60

type RatingTotals = Map<string, { count: number; avg: number }>

/**
 * Join published review ratings onto catalogue cards.
 *
 * The catalogue itself has no ratings — they live with the reviews. A card for
 * a product nobody has reviewed keeps the fields absent rather than reporting
 * a zero, so the storefront can render nothing instead of an unearned score.
 */
function withRatings<T extends { productId: string }>(items: T[], totals: RatingTotals): T[] {
  if (!totals.size) return items
  return items.map((item) => {
    const total = totals.get(item.productId)
    return total ? { ...item, ratingAvg: total.avg, ratingCount: total.count } : item
  })
}

async function ratingTotals(
  c: { get(k: "checkoutRepo"): AppEnv["Variables"]["checkoutRepo"] },
): Promise<RatingTotals> {
  return c.get("checkoutRepo").reviewTotalsByProduct().catch((): RatingTotals => new Map())
}

const SORTS: ReadonlySet<string> = new Set(["newest", "price_asc", "price_desc"])

function parseCatalogQuery(input: {
  category?: string
  q?: string
  limit?: string
  offset?: string
  sort?: string
}): CatalogListQuery {
  const rawLimit = Number(input.limit ?? 20)
  const rawOffset = Number(input.offset ?? 0)
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.trunc(rawLimit))) : 20
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.trunc(rawOffset)) : 0
  const category = input.category?.trim() || undefined
  const q = input.q?.trim() || undefined
  const sort =
    input.sort && SORTS.has(input.sort) ? (input.sort as CatalogSort) : undefined
  return { category, q, limit, offset, sort }
}

function catalogCacheKey(query: CatalogListQuery): string {
  // v3: response shape gained per-card ratingAvg/ratingCount.
  return `catalog:v3:${query.category ?? ""}:${query.q ?? ""}:${query.limit}:${query.offset}:${query.sort ?? ""}`
}

export const catalog = new Hono<AppEnv>().get("/", async (c) => {
  const query = parseCatalogQuery({
    category: c.req.query("category"),
    q: c.req.query("q"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
    sort: c.req.query("sort"),
  })
  const kv = (c.env as ApiEnv | undefined)?.CATALOG_KV
  const key = catalogCacheKey(query)
  if (kv) {
    const hit = await kv.get(key, "json")
    if (hit) return c.json(hit)
  }
  const [body, totals] = await Promise.all([
    c.get("repo").listCatalog(query),
    ratingTotals(c),
  ])
  const rated = { ...body, items: withRatings(body.items, totals) }
  if (kv) {
    await kv.put(key, JSON.stringify(rated), { expirationTtl: CATALOG_KV_TTL_SECONDS })
  }
  edgeCache(c, "catalog")
  return c.json(rated)
})

/**
 * Popularity shelves, from real orders only.
 *
 * `window=7d` ranks by units sold in the last week ("Trending"); no window
 * ranks all time ("Most ordered"). Products with no orders never appear, so
 * an empty shelf on a young catalogue renders empty rather than silently
 * degrading into an arbitrary slice of the catalogue dressed up as popular.
 */
catalog.get("/popular", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? 12)
  const limit = Number.isFinite(rawLimit) ? Math.min(48, Math.max(1, Math.trunc(rawLimit))) : 12
  const window = c.req.query("window")
  const since =
    window === "7d"
      ? new Date(Date.now() - 7 * 86_400_000)
      : window === "30d"
        ? new Date(Date.now() - 30 * 86_400_000)
        : undefined

  const counts = await c
    .get("checkoutRepo")
    .productOrderCounts(since)
    .catch(() => new Map<string, number>())
  if (counts.size === 0) return c.json({ items: [], total: 0 })

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  // Over-fetch: some ranked products may no longer have a sellable offer.
  const candidates = ranked.slice(0, limit * 3).map(([productId]) => productId)
  const cards = await c.get("repo").productCardsByIds(candidates)

  const [items, totals] = await Promise.all([
    Promise.resolve(
      candidates
        .map((id) => cards.get(id))
        .filter((card): card is NonNullable<typeof card> => card != null)
        .slice(0, limit),
    ),
    ratingTotals(c),
  ])

  return c.json({ items: withRatings(items, totals), total: items.length })
})

/**
 * Phase 2B — definition-backed facets with server counts for a category
 * (or the whole sellable catalogue). Never derived from free-form JSON.
 */
catalog.get("/facets", async (c) => {
  const category = c.req.query("category")?.trim() || undefined
  return c.json(await c.get("repo").catalogFacets(category))
})

