/**
 * Lightweight commerce stats from Medusa/Mercur query graph.
 * Money SoR stays Postgres — this is a simple ops snapshot, not a warehouse.
 */
import type { SearchProductDocument } from "./search/types"

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown }>
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === "object") return [data as Record<string, unknown>]
  return []
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  // Medusa big number shape { value, precision }
  if (v && typeof v === "object" && "value" in (v as object)) {
    const n = Number((v as { value: unknown }).value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

export type CommerceStats = {
  generated_at: string
  products: {
    published: number
    draft: number
    total: number
  }
  sellers: {
    open: number
    total: number
  }
  offers: {
    total: number
  }
  orders: {
    total: number
    /** Sum of order.total when present (major units as stored by Medusa) */
    gmv_by_currency: Record<string, number>
  }
  search?: {
    enabled: boolean
    indexed_hint?: number
  }
}

export async function collectCommerceStats(
  query: QueryService,
  opts?: { searchEnabled?: boolean },
): Promise<CommerceStats> {
  let productsPublished = 0
  let productsDraft = 0
  let productsTotal = 0
  let sellersOpen = 0
  let sellersTotal = 0
  let offersTotal = 0
  let ordersTotal = 0
  const gmv: Record<string, number> = {}

  try {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "status"],
      filters: {},
    })
    for (const p of asList(data)) {
      productsTotal += 1
      const st = String(p.status ?? "").toLowerCase()
      if (st === "published") productsPublished += 1
      else productsDraft += 1
    }
  } catch {
    /* module missing in edge env */
  }

  try {
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "status"],
      filters: {},
    })
    for (const s of asList(data)) {
      sellersTotal += 1
      if (String(s.status ?? "").toLowerCase() === "open") sellersOpen += 1
    }
  } catch {
    /* */
  }

  try {
    const { data } = await query.graph({
      entity: "offer",
      fields: ["id"],
      filters: {},
    })
    offersTotal = asList(data).length
  } catch {
    /* */
  }

  try {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "total", "currency_code", "status"],
      filters: {},
    })
    for (const o of asList(data)) {
      ordersTotal += 1
      const cur = String(o.currency_code ?? "unknown").toLowerCase()
      gmv[cur] = (gmv[cur] ?? 0) + num(o.total)
    }
  } catch {
    /* */
  }

  return {
    generated_at: new Date().toISOString(),
    products: {
      published: productsPublished,
      draft: productsDraft,
      total: productsTotal,
    },
    sellers: {
      open: sellersOpen,
      total: sellersTotal,
    },
    offers: { total: offersTotal },
    orders: {
      total: ordersTotal,
      gmv_by_currency: gmv,
    },
    search: opts?.searchEnabled
      ? { enabled: true }
      : { enabled: Boolean(opts?.searchEnabled) },
  }
}

/** Optional: count docs already in Meili for ops. */
export function statsFromSearchHits(
  hits: SearchProductDocument[],
): { with_seller: number; with_price: number; with_offer: number } {
  let with_seller = 0
  let with_price = 0
  let with_offer = 0
  for (const h of hits) {
    if (h.seller_id || h.seller_handle) with_seller += 1
    if (h.min_price != null) with_price += 1
    if (h.has_offer) with_offer += 1
  }
  return { with_seller, with_price, with_offer }
}
