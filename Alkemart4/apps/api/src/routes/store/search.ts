import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"

const SORTS = new Set(["newest", "price_asc", "price_desc"] as const)
const PESEWAS = /^\d+$/

function parseFilters(raw: string[]): Array<{ code: string; values: string[] }> {
  const out: Array<{ code: string; values: string[] }> = []
  for (const entry of raw) {
    const sep = entry.indexOf(":")
    if (sep <= 0) throw new HTTPException(400, { message: `invalid filter ${entry}` })
    const code = entry.slice(0, sep).trim()
    const values = entry
      .slice(sep + 1)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
    if (!code || values.length === 0) {
      throw new HTTPException(400, { message: `invalid filter ${entry}` })
    }
    out.push({ code, values })
  }
  return out
}

/**
 * Phase 2 discovery read path (Doc 03).
 *
 * - Approved aliases rewrite the query (synonym) or name a canonical target
 *   (redirect, returned as JSON for the client to navigate).
 * - Facets are definition-backed with server counts; unknown filter codes
 *   are 400, never silent zero-result pages.
 * - Zero/low-result queries are logged server-side for the quality queue;
 *   recovery suggestions ship in the response (no unrelated filler).
 */
export const storeSearch = new Hono<AppEnv>().get("/", async (c) => {
  const qRaw = c.req.query("q") ?? ""
  const filters = parseFilters(
    [...(c.req.queries("filter") ?? [])].flatMap((f) => f.split(";").filter(Boolean)),
  )
  const priceMin = c.req.query("priceMin")?.trim()
  const priceMax = c.req.query("priceMax")?.trim()
  if (priceMin !== undefined && !PESEWAS.test(priceMin)) {
    throw new HTTPException(400, { message: "priceMin must be integer pesewas" })
  }
  if (priceMax !== undefined && !PESEWAS.test(priceMax)) {
    throw new HTTPException(400, { message: "priceMax must be integer pesewas" })
  }
  const sortRaw = c.req.query("sort")?.trim()
  const sort = sortRaw && SORTS.has(sortRaw as "newest") ? (sortRaw as "newest" | "price_asc" | "price_desc") : undefined
  const rawLimit = Number(c.req.query("limit") ?? 20)
  const rawOffset = Number(c.req.query("offset") ?? 0)

  const repo = c.get("repo")
  if (filters.length > 0) {
    const known = new Set(
      (await repo.listAttributeDefinitions()).map((d) => d.code.toLowerCase()),
    )
    for (const f of filters) {
      if (!known.has(f.code.toLowerCase())) {
        throw new HTTPException(400, { message: `unknown facet ${f.code}` })
      }
    }
  }

  const result = await repo.searchProducts({
    q: qRaw,
    category: c.req.query("category")?.trim() || undefined,
    filters,
    priceMinPesewas: priceMin,
    priceMaxPesewas: priceMax,
    condition: (c.req.queries("condition") ?? []).filter(Boolean),
    sort,
    limit: Number.isFinite(rawLimit) ? rawLimit : 20,
    offset: Number.isFinite(rawOffset) ? rawOffset : 0,
  })
  if (qRaw.trim() && !result.redirect && (result.total === 0 || result.total < 3)) {
    await repo.logSearchQuery(qRaw, result.total)
  }
  return c.json(result)
})
