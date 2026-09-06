import { Hono } from "hono"
import type { ApiEnv } from "../../env"
import type { AppEnv } from "../../context"
import type { CatalogListQuery, CatalogSort } from "../../catalog-repository"

const CATALOG_KV_TTL_SECONDS = 60

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
  // v2: response shape gained card seller/stock/createdAt fields.
  return `catalog:v2:${query.category ?? ""}:${query.q ?? ""}:${query.limit}:${query.offset}:${query.sort ?? ""}`
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
  const body = await c.get("repo").listCatalog(query)
  if (kv) {
    await kv.put(key, JSON.stringify(body), { expirationTtl: CATALOG_KV_TTL_SECONDS })
  }
  return c.json(body)
})
