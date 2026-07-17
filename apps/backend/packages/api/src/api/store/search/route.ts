/**
 * GET|POST /store/search — product discovery via Meilisearch (when enabled).
 * Returns engine: "disabled" when MEILISEARCH_HOST is unset so storefront can fall back.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { searchHealth, searchProducts } from "../../../lib/search/service"
import type { SearchQueryInput } from "../../../lib/search/types"

function parseFilters(raw: unknown): SearchQueryInput["filters"] {
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const filters: NonNullable<SearchQueryInput["filters"]> = {}

  if (Array.isArray(o.category_handles)) {
    filters.category_handles = o.category_handles
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim())
  }
  if (Array.isArray(o.seller_handles)) {
    filters.seller_handles = o.seller_handles
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim())
  }
  if (typeof o.has_offer === "boolean") filters.has_offer = o.has_offer
  if (typeof o.min_price === "number") filters.min_price = o.min_price
  if (typeof o.max_price === "number") filters.max_price = o.max_price

  // Query-string style: category_handles=a,b
  if (typeof o.category_handles === "string" && o.category_handles.trim()) {
    filters.category_handles = o.category_handles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof o.seller_handles === "string" && o.seller_handles.trim()) {
    filters.seller_handles = o.seller_handles
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }

  return Object.keys(filters).length ? filters : undefined
}

function parseInput(req: MedusaRequest): SearchQueryInput {
  const body = (req.body ?? {}) as Record<string, unknown>
  const q =
    (typeof body.q === "string" ? body.q : undefined) ??
    (typeof req.query?.q === "string" ? req.query.q : undefined) ??
    ""

  const limitRaw = body.limit ?? req.query?.limit
  const offsetRaw = body.offset ?? req.query?.offset
  const limit =
    typeof limitRaw === "number"
      ? limitRaw
      : typeof limitRaw === "string"
        ? Number(limitRaw)
        : undefined
  const offset =
    typeof offsetRaw === "number"
      ? offsetRaw
      : typeof offsetRaw === "string"
        ? Number(offsetRaw)
        : undefined

  const filters =
    parseFilters(body.filters) ??
    parseFilters({
      category_handles: req.query?.category_handles,
      seller_handles: req.query?.seller_handles,
      has_offer:
        req.query?.has_offer === "true"
          ? true
          : req.query?.has_offer === "false"
            ? false
            : undefined,
      min_price:
        typeof req.query?.min_price === "string"
          ? Number(req.query.min_price)
          : undefined,
      max_price:
        typeof req.query?.max_price === "string"
          ? Number(req.query.max_price)
          : undefined,
    })

  return { q, limit, offset, filters }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (req.query?.health === "1" || req.query?.health === "true") {
    const health = await searchHealth()
    res.status(200).json(health)
    return
  }

  try {
    const result = await searchProducts(parseInput(req))
    res.status(200).json(result)
  } catch (e) {
    res.status(503).json({
      error: e instanceof Error ? e.message : "Search unavailable",
      engine: "error",
      hits: [],
      estimatedTotalHits: 0,
      facetDistribution: {},
    })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await searchProducts(parseInput(req))
    res.status(200).json(result)
  } catch (e) {
    res.status(503).json({
      error: e instanceof Error ? e.message : "Search unavailable",
      engine: "error",
      hits: [],
      estimatedTotalHits: 0,
      facetDistribution: {},
    })
  }
}
