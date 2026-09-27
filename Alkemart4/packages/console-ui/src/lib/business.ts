/**
 * Shapes of the business overview the API returns (apps/api/src/lib/business.ts)
 * and small helpers for asking for a range. The API decides every number;
 * consoles only display them.
 */

export type RangePreset = "7d" | "30d" | "90d" | "12m" | "ytd" | "since_joined" | "all"

/** A preset, a calendar year, or custom dates (YYYY-MM-DD, inclusive). */
export type RangeValue = { preset: RangePreset } | { year: number } | { from: string; to: string }

export const DEFAULT_RANGE: RangeValue = { preset: "30d" }

/** Query string for a range (no leading "?"). */
export function rangeQuery(v: RangeValue, extra?: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams()
  if ("preset" in v) q.set("preset", v.preset)
  else if ("year" in v) q.set("year", String(v.year))
  else {
    q.set("from", v.from)
    q.set("to", v.to)
  }
  for (const [k, val] of Object.entries(extra ?? {})) if (val) q.set(k, val)
  return q.toString()
}

/** Stable key for caching a range. */
export const rangeKey = (v: RangeValue) => rangeQuery(v)

export type OverviewSummary = {
  orders: number
  cancelled: number
  delivered: number
  units: number
  salesPesewas: string
  deliveryFeesPesewas: string
  avgOrderPesewas: string
  commissionPesewas: string
  takeHomePesewas: string
  buyers: number
  repeatBuyers: number
  payOnDeliveryShare: number
  pickupShare: number
  activeSellers: number
  newSellers: number | null
  series: { key: string; label: string; orders: number; salesPesewas: string }[]
  topProducts: { productId: string; title: string; units: number; salesPesewas: string }[]
  regions: { region: string; orders: number; salesPesewas: string }[]
  sellers: { sellerId: string; name: string | null; orders: number; salesPesewas: string; commissionPesewas: string }[]
}

export type BusinessOverview = {
  currency: string
  /** False for "all time" / "since joining": there's no earlier period to compare with. */
  comparable: boolean
  range: { from: string; to: string; label: string; bucket: "day" | "week" | "month" }
  previous: { from: string; to: string }
  current: OverviewSummary
  compare: Record<"orders" | "salesPesewas" | "takeHomePesewas" | "commissionPesewas" | "avgOrderPesewas" | "buyers", number | null>
  previousTotals: { orders: number; salesPesewas: string; takeHomePesewas: string; commissionPesewas: string; buyers: number }
  /** Seller overview only. */
  joinedAt?: string
  /** Admin, one seller. */
  sellerName?: string | null
}

export type StatementMonth = { period: string; status: "open" | "closed"; closedAt: string | null }

export type StatementLine =
  | {
      kind: "sale"
      date: string
      orderId: string
      orderGroupId: string
      orderRef: string
      sellerId: string
      paymentMethod: "cod" | "momo" | "card" | null
      fulfillmentMethod: "delivery" | "pickup"
      salesPesewas: string
      deliveryFeePesewas: string
      commissionPesewas: string
    }
  | { kind: "payout"; date: string; payoutId: string; sellerId: string; reference: string | null; netPesewas: string; commissionPesewas: string }

export type Statement = {
  period: string
  status: "open" | "closed"
  closedAt: string | null
  hash: string | null
  verified: boolean | null
  data: {
    scope: "seller" | "platform"
    sellerId: string | null
    period: string
    currency: string
    totals: {
      deliveredOrders: number
      salesPesewas: string
      deliveryFeesPesewas: string
      commissionPesewas: string
      onlineEarnedPesewas: string
      cashCollectedPesewas: string
      cashCommissionOwedPesewas: string
      payoutsPaidPesewas: string
    }
    lines: StatementLine[]
  }
}

/** "2026-09" → "September 2026". */
export function monthLabel(period: string, locale?: string): string {
  const [y, m] = period.split("-").map(Number)
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, 1)))
}

/** "+12%" / "−8%" / "new" / "same"; null when there's nothing to compare. */
export function changeText(v: number | null): string {
  if (v === null) return "new"
  if (Math.abs(v) < 0.005) return "same"
  const pct = Math.round(v * 100)
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`
}
