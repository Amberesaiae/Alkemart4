import { orderReference } from "@alkemart/shared/order-ref"

/**
 * Business overview and statements — the numbers sellers and admin see, from
 * one set of order facts. Everything here is pure: the API loads facts, this
 * decides ranges, totals, comparisons and statement lines. Apps only display.
 *
 * Money stays in integer minor units (bigint) throughout.
 */

export type PaymentMethodKind = "cod" | "momo" | "card"

/** One seller order, flattened with what reports need. */
export type OrderFact = {
  orderId: string
  orderGroupId: string
  sellerId: string
  placedAt: Date
  status: "placed" | "shipped" | "delivered" | "cancelled"
  deliveredAt: Date | null
  subtotalPesewas: bigint
  deliveryFeePesewas: bigint
  paymentMethod: PaymentMethodKind | null
  fulfillmentMethod: "delivery" | "pickup"
  /** Lower-cased buyer email, for unique/repeat buyers. Never shown. */
  buyerKey: string | null
  region: string | null
  city: string | null
  items: { productId: string; title: string; qty: number; amountPesewas: bigint }[]
}

export type PayoutFact = {
  payoutId: string
  sellerId: string
  status: string
  grossPesewas: bigint
  commissionPesewas: bigint
  netPesewas: bigint
  paidAt: Date | null
  reference: string | null
}

// ─── Ranges ──────────────────────────────────────────────────────────────

export type RangePreset = "7d" | "30d" | "90d" | "12m" | "ytd" | "since_joined" | "all"
export const RANGE_PRESETS: RangePreset[] = ["7d", "30d", "90d", "12m", "ytd", "since_joined", "all"]

/** What a screen asks for: a preset, a calendar year, or custom dates (YYYY-MM-DD, inclusive). */
export type RangeRequest = { preset?: RangePreset; year?: number; from?: string; to?: string }

export type Bucket = "day" | "week" | "month"

export type ResolvedRange = {
  /** Inclusive start, as an instant. */
  from: Date
  /** Exclusive end. */
  to: Date
  label: string
  bucket: Bucket
}

const DAY = 86_400_000
/** Longest custom range, so a request can't ask for decades of rows. */
export const MAX_RANGE_DAYS = 366 * 10

export class BusinessRangeError extends Error {}

type Clock = { now: Date; utcOffsetMinutes?: number; joinedAt?: Date | null; earliest?: Date | null }

/** Local calendar pieces of an instant in the market's clock. */
function local(d: Date, off: number) {
  const t = new Date(d.getTime() + off * 60_000)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), day: t.getUTCDate() }
}
/** Instant of local midnight for a local date. */
function at(y: number, m: number, day: number, off: number) {
  return new Date(Date.UTC(y, m, day) - off * 60_000)
}
const startOfDay = (d: Date, off: number) => {
  const l = local(d, off)
  return at(l.y, l.m, l.day, off)
}

function parseDay(s: string, off: number): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new BusinessRangeError("Dates look like 2026-09-26.")
  const d = at(Number(m[1]), Number(m[2]) - 1, Number(m[3]), off)
  if (Number.isNaN(d.getTime())) throw new BusinessRangeError("That date doesn't exist.")
  return d
}

export function bucketFor(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / DAY
  return days <= 31 ? "day" : days <= 183 ? "week" : "month"
}

const fmt = (d: Date, off: number, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(d.getTime() + off * 60_000))

export function resolveRange(req: RangeRequest, clock: Clock): ResolvedRange {
  const off = clock.utcOffsetMinutes ?? 0
  const today = startOfDay(clock.now, off)
  const tomorrow = new Date(today.getTime() + DAY)
  const make = (from: Date, to: Date, label: string): ResolvedRange => ({ from, to, label, bucket: bucketFor(from, to) })
  const days = (n: number) => new Date(today.getTime() - (n - 1) * DAY)

  if (req.from || req.to) {
    if (!req.from || !req.to) throw new BusinessRangeError("Pick both a start and an end date.")
    const from = parseDay(req.from, off)
    const to = new Date(parseDay(req.to, off).getTime() + DAY)
    if (to <= from) throw new BusinessRangeError("The end date is before the start date.")
    if ((to.getTime() - from.getTime()) / DAY > MAX_RANGE_DAYS) throw new BusinessRangeError("Pick a range of ten years or less.")
    const same = (a: Date, b: Date) => fmt(a, off, { year: "numeric" }) === fmt(b, off, { year: "numeric" })
    const last = new Date(to.getTime() - DAY)
    return make(from, to, `${fmt(from, off, { day: "numeric", month: "short", ...(same(from, last) ? {} : { year: "numeric" }) })} – ${fmt(last, off, { day: "numeric", month: "short", year: "numeric" })}`)
  }
  if (req.year != null) {
    if (!Number.isInteger(req.year) || req.year < 2000 || req.year > local(clock.now, off).y) throw new BusinessRangeError("Pick a year up to this one.")
    return make(at(req.year, 0, 1, off), at(req.year + 1, 0, 1, off), String(req.year))
  }
  switch (req.preset ?? "30d") {
    case "7d":
      return make(days(7), tomorrow, "Last 7 days")
    case "30d":
      return make(days(30), tomorrow, "Last 30 days")
    case "90d":
      return make(days(90), tomorrow, "Last 3 months")
    case "12m": {
      const l = local(clock.now, off)
      return make(at(l.y, l.m - 11, 1, off), at(l.y, l.m + 1, 1, off), "Last 12 months")
    }
    case "ytd": {
      const l = local(clock.now, off)
      return make(at(l.y, 0, 1, off), tomorrow, "This year")
    }
    case "since_joined": {
      const start = clock.joinedAt ? startOfDay(clock.joinedAt, off) : days(30)
      return make(start, tomorrow, "Since you joined")
    }
    case "all": {
      const first = clock.earliest ?? clock.joinedAt
      return make(first ? startOfDay(first, off) : days(30), tomorrow, "All time")
    }
  }
}

/** The same length of time immediately before, for "vs previous". */
export function previousRange(r: ResolvedRange): ResolvedRange {
  const len = r.to.getTime() - r.from.getTime()
  return { from: new Date(r.from.getTime() - len), to: r.from, label: "Previous period", bucket: r.bucket }
}

// ─── Summary ─────────────────────────────────────────────────────────────

export type SeriesPoint = { key: string; label: string; orders: number; salesPesewas: bigint }

export type BusinessSummary = {
  orders: number
  cancelled: number
  delivered: number
  units: number
  /** Item value of orders not cancelled. */
  salesPesewas: bigint
  deliveryFeesPesewas: bigint
  avgOrderPesewas: bigint
  /** Commission on sales, at each seller's rate. */
  commissionPesewas: bigint
  /** Sales minus commission — what the seller keeps. */
  takeHomePesewas: bigint
  buyers: number
  /** Buyers with more than one order in the range. */
  repeatBuyers: number
  /** Share of orders (0–1). */
  payOnDeliveryShare: number
  pickupShare: number
  activeSellers: number
  series: SeriesPoint[]
  topProducts: { productId: string; title: string; units: number; salesPesewas: bigint }[]
  regions: { region: string; orders: number; salesPesewas: bigint }[]
  sellers: { sellerId: string; orders: number; salesPesewas: bigint; commissionPesewas: bigint }[]
}

const commissionOf = (amount: bigint, bps: number) => (amount * BigInt(Math.round(bps))) / 10_000n

const ymd = (l: { y: number; m: number; day: number }) => `${l.y}-${String(l.m + 1).padStart(2, "0")}-${String(l.day).padStart(2, "0")}`

function seriesKeys(r: ResolvedRange, off: number): { key: string; label: string; start: Date }[] {
  const out: { key: string; label: string; start: Date }[] = []
  let cur = new Date(r.from)
  if (r.bucket === "week") {
    // Weeks start on Monday, local time.
    const l = local(cur, off)
    const dow = (new Date(Date.UTC(l.y, l.m, l.day)).getUTCDay() + 6) % 7
    cur = at(l.y, l.m, l.day - dow, off)
  } else if (r.bucket === "month") {
    const l = local(cur, off)
    cur = at(l.y, l.m, 1, off)
  }
  while (cur < r.to && out.length < 400) {
    const l = local(cur, off)
    if (r.bucket === "day") {
      out.push({ key: ymd(l), label: fmt(cur, off, { day: "numeric", month: "short" }), start: cur })
      cur = at(l.y, l.m, l.day + 1, off)
    } else if (r.bucket === "week") {
      out.push({ key: `w${ymd(l)}`, label: fmt(cur, off, { day: "numeric", month: "short" }), start: cur })
      cur = at(l.y, l.m, l.day + 7, off)
    } else {
      out.push({ key: `${l.y}-${String(l.m + 1).padStart(2, "0")}`, label: fmt(cur, off, { month: "short", year: "2-digit" }), start: cur })
      cur = at(l.y, l.m + 1, 1, off)
    }
  }
  return out
}

/**
 * Totals for orders placed in the range (cancelled orders count only as
 * cancelled). Commission uses each seller's rate from `commissionBps`.
 */
export function summarize(
  facts: OrderFact[],
  r: ResolvedRange,
  opts: { commissionBps: (sellerId: string) => number; utcOffsetMinutes?: number; withSeries?: boolean },
): BusinessSummary {
  const off = opts.utcOffsetMinutes ?? 0
  const inRange = facts.filter((f) => f.placedAt >= r.from && f.placedAt < r.to)
  const live = inRange.filter((f) => f.status !== "cancelled")
  const buyers = new Map<string, number>()
  const products = new Map<string, { productId: string; title: string; units: number; salesPesewas: bigint }>()
  const regions = new Map<string, { region: string; orders: number; salesPesewas: bigint }>()
  const sellers = new Map<string, { sellerId: string; orders: number; salesPesewas: bigint; commissionPesewas: bigint }>()
  let sales = 0n
  let fees = 0n
  let commission = 0n
  let units = 0
  for (const f of live) {
    sales += f.subtotalPesewas
    fees += f.deliveryFeePesewas
    const c = commissionOf(f.subtotalPesewas, opts.commissionBps(f.sellerId))
    commission += c
    if (f.buyerKey) buyers.set(f.buyerKey, (buyers.get(f.buyerKey) ?? 0) + 1)
    for (const i of f.items) {
      units += i.qty
      const p = products.get(i.productId) ?? { productId: i.productId, title: i.title, units: 0, salesPesewas: 0n }
      p.units += i.qty
      p.salesPesewas += i.amountPesewas
      products.set(i.productId, p)
    }
    const region = f.region ?? "Not given"
    const g = regions.get(region) ?? { region, orders: 0, salesPesewas: 0n }
    g.orders += 1
    g.salesPesewas += f.subtotalPesewas
    regions.set(region, g)
    const s = sellers.get(f.sellerId) ?? { sellerId: f.sellerId, orders: 0, salesPesewas: 0n, commissionPesewas: 0n }
    s.orders += 1
    s.salesPesewas += f.subtotalPesewas
    s.commissionPesewas += c
    sellers.set(f.sellerId, s)
  }
  const byBig = <T extends { salesPesewas: bigint }>(a: T, b: T) => (b.salesPesewas > a.salesPesewas ? 1 : b.salesPesewas < a.salesPesewas ? -1 : 0)

  let series: SeriesPoint[] = []
  if (opts.withSeries !== false) {
    const keys = seriesKeys(r, off)
    series = keys.map((k) => ({ key: k.key, label: k.label, orders: 0, salesPesewas: 0n }))
    for (const f of live) {
      let idx = -1
      for (let i = keys.length - 1; i >= 0; i--) {
        if (f.placedAt >= keys[i]!.start) {
          idx = i
          break
        }
      }
      if (idx >= 0) {
        series[idx]!.orders += 1
        series[idx]!.salesPesewas += f.subtotalPesewas
      }
    }
  }

  const n = live.length
  return {
    orders: n,
    cancelled: inRange.length - n,
    delivered: live.filter((f) => f.status === "delivered").length,
    units,
    salesPesewas: sales,
    deliveryFeesPesewas: fees,
    avgOrderPesewas: n ? sales / BigInt(n) : 0n,
    commissionPesewas: commission,
    takeHomePesewas: sales - commission,
    buyers: buyers.size,
    repeatBuyers: [...buyers.values()].filter((v) => v > 1).length,
    payOnDeliveryShare: n ? live.filter((f) => f.paymentMethod === "cod").length / n : 0,
    pickupShare: n ? live.filter((f) => f.fulfillmentMethod === "pickup").length / n : 0,
    activeSellers: sellers.size,
    series,
    topProducts: [...products.values()].sort(byBig).slice(0, 10),
    regions: [...regions.values()].sort(byBig),
    sellers: [...sellers.values()].sort(byBig),
  }
}

/** Change vs the previous period as a fraction; null when there was nothing before. */
export function change(current: bigint | number, previous: bigint | number): number | null {
  const c = Number(current)
  const p = Number(previous)
  if (!p) return c ? null : 0
  return (c - p) / p
}

// ─── Monthly statements ──────────────────────────────────────────────────

export type StatementScope = "seller" | "platform"

export type StatementLine =
  | {
      kind: "sale"
      date: string
      orderId: string
      /** The buyer's order (group) and its short number, as buyers and sellers quote it. */
      orderGroupId: string
      orderRef: string
      sellerId: string
      paymentMethod: PaymentMethodKind | null
      fulfillmentMethod: "delivery" | "pickup"
      salesPesewas: string
      deliveryFeePesewas: string
      commissionPesewas: string
    }
  | { kind: "payout"; date: string; payoutId: string; sellerId: string; reference: string | null; netPesewas: string; commissionPesewas: string }

export type StatementData = {
  version: 1
  scope: StatementScope
  sellerId: string | null
  period: string
  currency: string
  totals: {
    deliveredOrders: number
    salesPesewas: string
    deliveryFeesPesewas: string
    commissionPesewas: string
    /** Online-paid sales minus their commission — what payouts owe for the month. */
    onlineEarnedPesewas: string
    /** Cash the seller collected on pay-on-delivery orders (items + delivery). */
    cashCollectedPesewas: string
    /** Commission owed on pay-on-delivery sales. */
    cashCommissionOwedPesewas: string
    payoutsPaidPesewas: string
  }
  lines: StatementLine[]
}

/** "2026-09" → the month's local start and end. */
export function monthRange(period: string, utcOffsetMinutes = 0): { from: Date; to: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(period)
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new BusinessRangeError("Months look like 2026-09.")
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  return { from: at(y, mo, 1, utcOffsetMinutes), to: at(y, mo + 1, 1, utcOffsetMinutes) }
}

export function monthOf(d: Date, utcOffsetMinutes = 0): string {
  const l = local(d, utcOffsetMinutes)
  return `${l.y}-${String(l.m + 1).padStart(2, "0")}`
}

/** Months from `start` to `end` inclusive, newest first. */
export function monthsBetween(start: Date, end: Date, utcOffsetMinutes = 0): string[] {
  const out: string[] = []
  const a = local(start, utcOffsetMinutes)
  const b = local(end, utcOffsetMinutes)
  let y = b.y
  let m = b.m
  while ((y > a.y || (y === a.y && m >= a.m)) && out.length < 600) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`)
    m -= 1
    if (m < 0) {
      m = 11
      y -= 1
    }
  }
  return out
}

/**
 * A month's statement. Lines are dated by when money moved — a sale when it
 * was delivered, a payout when it was paid — so a closed month never changes;
 * anything later lands in a later month.
 */
export function buildStatement(input: {
  scope: StatementScope
  sellerId: string | null
  period: string
  currency: string
  facts: OrderFact[]
  payouts: PayoutFact[]
  commissionBps: (sellerId: string) => number
  utcOffsetMinutes?: number
}): StatementData {
  const { from, to } = monthRange(input.period, input.utcOffsetMinutes)
  const mine = (sellerId: string) => input.scope === "platform" || sellerId === input.sellerId
  const lines: StatementLine[] = []
  let sales = 0n
  let fees = 0n
  let commission = 0n
  let onlineEarned = 0n
  let cash = 0n
  let cashCommission = 0n
  let paid = 0n
  let delivered = 0
  for (const f of input.facts) {
    if (!mine(f.sellerId) || f.status !== "delivered" || !f.deliveredAt || f.deliveredAt < from || f.deliveredAt >= to) continue
    const c = commissionOf(f.subtotalPesewas, input.commissionBps(f.sellerId))
    delivered += 1
    sales += f.subtotalPesewas
    fees += f.deliveryFeePesewas
    commission += c
    if (f.paymentMethod === "cod") {
      cash += f.subtotalPesewas + f.deliveryFeePesewas
      cashCommission += c
    } else {
      onlineEarned += f.subtotalPesewas - c
    }
    lines.push({
      kind: "sale",
      date: f.deliveredAt.toISOString(),
      orderId: f.orderId,
      orderGroupId: f.orderGroupId,
      orderRef: orderReference(f.orderGroupId),
      sellerId: f.sellerId,
      paymentMethod: f.paymentMethod,
      fulfillmentMethod: f.fulfillmentMethod,
      salesPesewas: f.subtotalPesewas.toString(),
      deliveryFeePesewas: f.deliveryFeePesewas.toString(),
      commissionPesewas: c.toString(),
    })
  }
  for (const p of input.payouts) {
    if (!mine(p.sellerId) || p.status !== "paid" || !p.paidAt || p.paidAt < from || p.paidAt >= to) continue
    paid += p.netPesewas
    lines.push({
      kind: "payout",
      date: p.paidAt.toISOString(),
      payoutId: p.payoutId,
      sellerId: p.sellerId,
      reference: p.reference,
      netPesewas: p.netPesewas.toString(),
      commissionPesewas: p.commissionPesewas.toString(),
    })
  }
  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.kind + ("orderId" in a ? a.orderId : a.payoutId)).localeCompare(b.kind + ("orderId" in b ? b.orderId : b.payoutId))))
  return {
    version: 1,
    scope: input.scope,
    sellerId: input.sellerId,
    period: input.period,
    currency: input.currency,
    totals: {
      deliveredOrders: delivered,
      salesPesewas: sales.toString(),
      deliveryFeesPesewas: fees.toString(),
      commissionPesewas: commission.toString(),
      onlineEarnedPesewas: onlineEarned.toString(),
      cashCollectedPesewas: cash.toString(),
      cashCommissionOwedPesewas: cashCommission.toString(),
      payoutsPaidPesewas: paid.toString(),
    },
    lines,
  }
}

/** JSON with sorted keys, so the same statement always hashes the same. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`
  if (v && typeof v === "object") {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(v)
}

/** SHA-256 of the canonical statement, hex. Anyone can recompute it to prove a statement wasn't edited. */
export async function statementHash(data: StatementData): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(data))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
