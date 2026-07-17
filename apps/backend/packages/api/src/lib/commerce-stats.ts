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

/** Coerce Medusa money fields (number | string | BigNumberJSON | nested). */
export function moneyAmount(v: unknown): number {
  if (v == null) return 0
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("value" in o) {
      const n = Number(o.value)
      return Number.isFinite(n) ? n : 0
    }
    if ("numeric" in o) {
      const n = Number(o.numeric)
      return Number.isFinite(n) ? n : 0
    }
    if ("amount" in o) return moneyAmount(o.amount)
    if ("total" in o) return moneyAmount(o.total)
  }
  return 0
}

export type DayPoint = {
  date: string
  orders: number
  gmv: number
}

export type NamedCount = {
  name: string
  value: number
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
    by_status: NamedCount[]
  }
  /** Last N days order volume + GMV (primary currency preferred) */
  series: {
    days: DayPoint[]
    primary_currency: string
  }
  catalog_mix: NamedCount[]
  search?: {
    enabled: boolean
    indexed_hint?: number
  }
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function lastNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(dayKey(d))
  }
  return out
}

function orderTotal(o: Record<string, unknown>): number {
  const summary = o.summary as Record<string, unknown> | undefined
  return (
    moneyAmount(o.total) ||
    moneyAmount(summary?.total) ||
    moneyAmount(summary?.raw_total) ||
    moneyAmount(o.raw_total)
  )
}

export async function collectCommerceStats(
  query: QueryService,
  opts?: { searchEnabled?: boolean; days?: number },
): Promise<CommerceStats> {
  const daysN = opts?.days ?? 14
  let productsPublished = 0
  let productsDraft = 0
  let productsTotal = 0
  let sellersOpen = 0
  let sellersTotal = 0
  let offersTotal = 0
  let ordersTotal = 0
  const gmv: Record<string, number> = {}
  const statusCounts = new Map<string, number>()
  const dayOrders = new Map<string, number>()
  const dayGmv = new Map<string, number>()
  const keys = lastNDays(daysN)
  for (const k of keys) {
    dayOrders.set(k, 0)
    dayGmv.set(k, 0)
  }

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
    /* */
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

  const loadOrders = async (fields: string[]) => {
    const { data } = await query.graph({
      entity: "order",
      fields,
      filters: {},
    })
    return asList(data)
  }

  let orderRows: Record<string, unknown>[] = []
  try {
    orderRows = await loadOrders([
      "id",
      "total",
      "summary.total",
      "summary.raw_total",
      "currency_code",
      "status",
      "created_at",
    ])
  } catch {
    try {
      orderRows = await loadOrders([
        "id",
        "total",
        "currency_code",
        "status",
        "created_at",
      ])
    } catch {
      orderRows = []
    }
  }

  for (const o of orderRows) {
    ordersTotal += 1
    const cur = String(o.currency_code ?? "unknown").toLowerCase()
    const total = orderTotal(o)
    gmv[cur] = (gmv[cur] ?? 0) + total

    const st = String(o.status ?? "unknown").toLowerCase() || "unknown"
    statusCounts.set(st, (statusCounts.get(st) ?? 0) + 1)

    const created = o.created_at ? new Date(String(o.created_at)) : null
    if (created && !Number.isNaN(created.getTime())) {
      const k = dayKey(created)
      if (dayOrders.has(k)) {
        dayOrders.set(k, (dayOrders.get(k) ?? 0) + 1)
        dayGmv.set(k, (dayGmv.get(k) ?? 0) + total)
      }
    }
  }

  const primary_currency =
    Object.entries(gmv).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    (Object.keys(gmv)[0] || "ghs")

  const seriesDays: DayPoint[] = keys.map((date) => ({
    date,
    orders: dayOrders.get(date) ?? 0,
    gmv: dayGmv.get(date) ?? 0,
  }))

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
      by_status: Array.from(statusCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    },
    series: {
      days: seriesDays,
      primary_currency,
    },
    catalog_mix: [
      { name: "Published products", value: productsPublished },
      { name: "Draft products", value: productsDraft },
      { name: "Open sellers", value: sellersOpen },
      { name: "Offers", value: offersTotal },
    ].filter((x) => x.value > 0),
    search: {
      enabled: Boolean(opts?.searchEnabled),
    },
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
