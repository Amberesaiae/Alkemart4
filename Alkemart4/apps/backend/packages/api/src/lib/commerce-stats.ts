/**
 * Live commerce stats from Medusa/Mercur query graph (Postgres SoR).
 * Not a warehouse, not mock data — ops snapshot for Admin / Seller Hub.
 */
import type { SearchProductDocument } from "./search/types"

type QueryService = {
  graph: (args: unknown) => Promise<{ data: unknown; metadata?: { count?: number } }>
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
  source: "medusa_graph"
  scope: "platform" | "seller"
  seller_id?: string
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
    /** Sum of order.total (major units as returned by Medusa) */
    gmv_by_currency: Record<string, number>
    by_status: NamedCount[]
  }
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

function emptyDayMaps(daysN: number) {
  const dayOrders = new Map<string, number>()
  const dayGmv = new Map<string, number>()
  const keys = lastNDays(daysN)
  for (const k of keys) {
    dayOrders.set(k, 0)
    dayGmv.set(k, 0)
  }
  return { keys, dayOrders, dayGmv }
}

function accumulateOrders(
  orderRows: Record<string, unknown>[],
  dayOrders: Map<string, number>,
  dayGmv: Map<string, number>,
) {
  const gmv: Record<string, number> = {}
  const statusCounts = new Map<string, number>()
  let ordersTotal = 0

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

  return { gmv, statusCounts, ordersTotal }
}

async function loadOrdersByIds(
  query: QueryService,
  orderIds: string[],
): Promise<Record<string, unknown>[]> {
  if (!orderIds.length) return []
  const fieldsFull = [
    "id",
    "total",
    "summary.total",
    "summary.raw_total",
    "currency_code",
    "status",
    "created_at",
  ]
  const fieldsLite = ["id", "total", "currency_code", "status", "created_at"]
  try {
    const { data } = await query.graph({
      entity: "order",
      fields: fieldsFull,
      filters: { id: orderIds },
    })
    return asList(data)
  } catch {
    try {
      const { data } = await query.graph({
        entity: "order",
        fields: fieldsLite,
        filters: { id: orderIds },
      })
      return asList(data)
    } catch {
      return []
    }
  }
}

async function loadAllOrders(query: QueryService): Promise<Record<string, unknown>[]> {
  const fieldsFull = [
    "id",
    "total",
    "summary.total",
    "summary.raw_total",
    "currency_code",
    "status",
    "created_at",
  ]
  const fieldsLite = ["id", "total", "currency_code", "status", "created_at"]
  try {
    const { data } = await query.graph({
      entity: "order",
      fields: fieldsFull,
      filters: {},
    })
    return asList(data)
  } catch {
    try {
      const { data } = await query.graph({
        entity: "order",
        fields: fieldsLite,
        filters: {},
      })
      return asList(data)
    } catch {
      return []
    }
  }
}

export async function collectCommerceStats(
  query: QueryService,
  opts?: { searchEnabled?: boolean; days?: number },
): Promise<CommerceStats> {
  const daysN = opts?.days ?? 30
  let productsPublished = 0
  let productsDraft = 0
  let productsTotal = 0
  let sellersOpen = 0
  let sellersTotal = 0
  let offersTotal = 0
  const { keys, dayOrders, dayGmv } = emptyDayMaps(daysN)

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

  const orderRows = await loadAllOrders(query)
  const { gmv, statusCounts, ordersTotal } = accumulateOrders(
    orderRows,
    dayOrders,
    dayGmv,
  )

  const primary_currency =
    Object.entries(gmv).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    (Object.keys(gmv)[0] || "ghs")

  return {
    generated_at: new Date().toISOString(),
    source: "medusa_graph",
    scope: "platform",
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
      days: keys.map((date) => ({
        date,
        orders: dayOrders.get(date) ?? 0,
        gmv: dayGmv.get(date) ?? 0,
      })),
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

/**
 * Seller-scoped live stats via order_seller / product_seller / offer links.
 */
export async function collectSellerCommerceStats(
  query: QueryService,
  sellerId: string,
  opts?: { days?: number },
): Promise<CommerceStats> {
  const daysN = opts?.days ?? 30
  const { keys, dayOrders, dayGmv } = emptyDayMaps(daysN)

  // Orders for this seller (link table)
  let orderIds: string[] = []
  try {
    const { data } = await query.graph({
      entity: "order_seller",
      fields: ["order_id", "seller_id"],
      filters: { seller_id: sellerId },
    })
    orderIds = asList(data)
      .map((r) => String(r.order_id ?? ""))
      .filter(Boolean)
  } catch {
    orderIds = []
  }

  const orderRows = await loadOrdersByIds(query, orderIds)
  const { gmv, statusCounts, ordersTotal } = accumulateOrders(
    orderRows,
    dayOrders,
    dayGmv,
  )

  // Products linked to seller
  let productsPublished = 0
  let productsDraft = 0
  let productsTotal = 0
  try {
    const { data: links } = await query.graph({
      entity: "product_seller",
      fields: ["product_id", "seller_id"],
      filters: { seller_id: sellerId },
    })
    const productIds = asList(links)
      .map((r) => String(r.product_id ?? ""))
      .filter(Boolean)
    if (productIds.length) {
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "status"],
        filters: { id: productIds },
      })
      for (const p of asList(products)) {
        productsTotal += 1
        const st = String(p.status ?? "").toLowerCase()
        if (st === "published") productsPublished += 1
        else productsDraft += 1
      }
    }
  } catch {
    /* product_seller shape may differ — try offer-based catalog */
  }

  // Offers for seller
  let offersTotal = 0
  try {
    const { data } = await query.graph({
      entity: "offer",
      fields: ["id", "seller_id"],
      filters: { seller_id: sellerId },
    })
    offersTotal = asList(data).length
  } catch {
    try {
      // alternate: seller.offer relation
      const { data } = await query.graph({
        entity: "seller",
        fields: ["id", "offers.id"],
        filters: { id: sellerId },
      })
      const seller = asList(data)[0]
      const offers = seller?.offers
      offersTotal = Array.isArray(offers) ? offers.length : 0
    } catch {
      offersTotal = 0
    }
  }

  const primary_currency =
    Object.entries(gmv).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ghs"

  return {
    generated_at: new Date().toISOString(),
    source: "medusa_graph",
    scope: "seller",
    seller_id: sellerId,
    products: {
      published: productsPublished,
      draft: productsDraft,
      total: productsTotal,
    },
    sellers: { open: 1, total: 1 },
    offers: { total: offersTotal },
    orders: {
      total: ordersTotal,
      gmv_by_currency: gmv,
      by_status: Array.from(statusCounts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    },
    series: {
      days: keys.map((date) => ({
        date,
        orders: dayOrders.get(date) ?? 0,
        gmv: dayGmv.get(date) ?? 0,
      })),
      primary_currency,
    },
    catalog_mix: [
      { name: "Published products", value: productsPublished },
      { name: "Draft products", value: productsDraft },
      { name: "Offers", value: offersTotal },
      { name: "Orders", value: ordersTotal },
    ].filter((x) => x.value > 0),
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
