import {
  BusinessRangeError,
  RANGE_PRESETS,
  buildStatement,
  change,
  monthOf,
  monthRange,
  previousRange,
  resolveRange,
  statementHash,
  summarize,
  type BusinessSummary,
  type OrderFact,
  type RangePreset,
  type RangeRequest,
  type ResolvedRange,
  type StatementData,
  type StatementScope,
} from "@alkemart/domain"
import { orderReference } from "@alkemart/shared/order-ref"
import { resolveMarket } from "@alkemart/shared/markets"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AuthSeller } from "../auth-repository"
import type { AppEnv } from "../context"

/**
 * Business overview + statements for sellers (their own shop) and admin
 * (the whole platform, or one seller). The domain decides every number;
 * this loads facts, freezes statements, and serialises.
 */

type C = Context<AppEnv>

const market = () => resolveMarket()

export function rangeRequestFrom(q: Record<string, string | undefined>): RangeRequest {
  const preset = RANGE_PRESETS.includes(q.preset as RangePreset) ? (q.preset as RangePreset) : undefined
  const year = q.year && /^\d{4}$/.test(q.year) ? Number(q.year) : undefined
  return { preset, year, from: q.from || undefined, to: q.to || undefined }
}

async function commissionLookup(c: C): Promise<(sellerId: string) => number> {
  const sellers = await c.get("authRepo").listSellers().catch(() => [])
  const bps = new Map(sellers.map((s) => [s.id, s.commissionBps]))
  const fallback = market().defaultCommissionBps
  return (id) => bps.get(id) ?? fallback
}

function resolve(c: C, req: RangeRequest, clock: { joinedAt?: Date | null; earliest?: Date | null }) {
  try {
    return resolveRange(req, { now: new Date(), utcOffsetMinutes: market().utcOffsetMinutes, ...clock })
  } catch (err) {
    if (err instanceof BusinessRangeError) throw new HTTPException(400, { message: err.message })
    throw err
  }
}

const money = (v: bigint) => v.toString()

function serializeSummary(s: BusinessSummary, names?: Map<string, string>) {
  return {
    orders: s.orders,
    cancelled: s.cancelled,
    delivered: s.delivered,
    units: s.units,
    salesPesewas: money(s.salesPesewas),
    deliveryFeesPesewas: money(s.deliveryFeesPesewas),
    avgOrderPesewas: money(s.avgOrderPesewas),
    commissionPesewas: money(s.commissionPesewas),
    takeHomePesewas: money(s.takeHomePesewas),
    buyers: s.buyers,
    repeatBuyers: s.repeatBuyers,
    payOnDeliveryShare: s.payOnDeliveryShare,
    pickupShare: s.pickupShare,
    activeSellers: s.activeSellers,
    series: s.series.map((p) => ({ key: p.key, label: p.label, orders: p.orders, salesPesewas: money(p.salesPesewas) })),
    topProducts: s.topProducts.map((p) => ({ ...p, salesPesewas: money(p.salesPesewas) })),
    regions: s.regions.map((r) => ({ ...r, salesPesewas: money(r.salesPesewas) })),
    sellers: s.sellers.slice(0, 20).map((x) => ({
      ...x,
      name: names?.get(x.sellerId) ?? null,
      salesPesewas: money(x.salesPesewas),
      commissionPesewas: money(x.commissionPesewas),
    })),
  }
}

const iso = (r: ResolvedRange) => ({ from: r.from.toISOString(), to: r.to.toISOString(), label: r.label, bucket: r.bucket })

/**
 * The whole platform's summary for a preset, unserialised and uncapped
 * (every shop, bigint money). Admin screens that show platform or per-shop
 * totals read this, so they always agree with Insights → Business.
 */
export async function platformSummary(c: C, preset: "all" | "30d"): Promise<BusinessSummary> {
  const checkout = c.get("checkoutRepo")
  const all = preset === "all" ? await checkout.listOrderFacts({}) : null
  const earliest = all?.reduce<Date | null>((m, f) => (!m || f.placedAt < m ? f.placedAt : m), null) ?? null
  const range = resolve(c, { preset }, { earliest })
  const [facts, bps] = await Promise.all([all ?? checkout.listOrderFacts({ placedFrom: range.from, placedTo: range.to }), commissionLookup(c)])
  return summarize(facts, range, { commissionBps: bps, utcOffsetMinutes: market().utcOffsetMinutes, withSeries: preset !== "all" })
}

/** Overview for a range, with the previous period of the same length for comparison. */
export async function overview(c: C, input: { sellerId: string | null; req: RangeRequest; joinedAt?: Date | null }) {
  const checkout = c.get("checkoutRepo")
  const joinedAt = input.joinedAt ?? null
  const earliestFacts = input.req.preset === "all" ? await checkout.listOrderFacts({ sellerId: input.sellerId ?? undefined }) : null
  const earliest = earliestFacts?.reduce<Date | null>((m, f) => (!m || f.placedAt < m ? f.placedAt : m), null) ?? null
  const range = resolve(c, input.req, { joinedAt, earliest })
  const prev = previousRange(range)
  const [facts, bps, sellers] = await Promise.all([
    earliestFacts ?? checkout.listOrderFacts({ sellerId: input.sellerId ?? undefined, placedFrom: prev.from, placedTo: range.to }),
    commissionLookup(c),
    input.sellerId ? Promise.resolve([] as AuthSeller[]) : c.get("authRepo").listSellers().catch((): AuthSeller[] => []),
  ])
  const off = market().utcOffsetMinutes
  const cur = summarize(facts, range, { commissionBps: bps, utcOffsetMinutes: off })
  const before = summarize(facts, prev, { commissionBps: bps, utcOffsetMinutes: off, withSeries: false })
  const names = new Map(sellers.map((s) => [s.id, s.name]))
  const newSellers = input.sellerId ? null : sellers.filter((s) => s.createdAt >= range.from && s.createdAt < range.to).length
  // "All time" / "since joining" have nothing before them worth comparing.
  const comparable = input.req.preset !== "all" && input.req.preset !== "since_joined"
  return {
    currency: market().currencyCode,
    comparable,
    range: iso(range),
    previous: iso(prev),
    current: { ...serializeSummary(cur, names), newSellers },
    compare: {
      orders: change(cur.orders, before.orders),
      salesPesewas: change(cur.salesPesewas, before.salesPesewas),
      takeHomePesewas: change(cur.takeHomePesewas, before.takeHomePesewas),
      commissionPesewas: change(cur.commissionPesewas, before.commissionPesewas),
      avgOrderPesewas: change(cur.avgOrderPesewas, before.avgOrderPesewas),
      buyers: change(cur.buyers, before.buyers),
    },
    previousTotals: {
      orders: before.orders,
      salesPesewas: money(before.salesPesewas),
      takeHomePesewas: money(before.takeHomePesewas),
      commissionPesewas: money(before.commissionPesewas),
      buyers: before.buyers,
    },
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v)
  // Quote, and defuse spreadsheet formulas (=, +, -, @ at the start).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
/** "2026-08-02 16:57" in the market's clock — readable in any spreadsheet. */
const when = (d: Date | string) => {
  const t = new Date(new Date(d).getTime() + market().utcOffsetMinutes * 60_000).toISOString()
  return `${t.slice(0, 10)} ${t.slice(11, 16)}`
}
const PAY_LABEL: Record<string, string> = { cod: "Pay on delivery", momo: "Mobile money", card: "Card" }
const major = (pesewas: bigint | string) => (Number(pesewas) / market().minorUnitsPerMajor).toFixed(2)
export const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n"

export function csvResponse(c: C, filename: string, body: string) {
  c.header("Content-Type", "text/csv; charset=utf-8")
  c.header("Content-Disposition", `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`)
  c.header("Cache-Control", "no-store")
  // Excel opens UTF-8 CSV correctly with a BOM (cedi sign, names).
  return c.body(`﻿${body}`)
}

/** Every order placed in the range, one row each — the record behind the overview. */
export async function ordersCsv(c: C, input: { sellerId: string | null; req: RangeRequest; joinedAt?: Date | null }) {
  const range = resolve(c, input.req, { joinedAt: input.joinedAt ?? null })
  const [facts, bps, sellers] = await Promise.all([
    c.get("checkoutRepo").listOrderFacts({ sellerId: input.sellerId ?? undefined, placedFrom: range.from, placedTo: range.to }),
    commissionLookup(c),
    c.get("authRepo").listSellers().catch(() => []),
  ])
  const names = new Map(sellers.map((s) => [s.id, s.name]))
  const cur = market().currencyCode
  const sorted = [...facts].sort((a, b) => +a.placedAt - +b.placedAt)
  const rows: unknown[][] = [
    [
      "Placed",
      "Order",
      ...(input.sellerId ? [] : ["Shop"]),
      "Status",
      "Delivered",
      "Payment",
      "Fulfilment",
      "Items",
      `Sales (${cur})`,
      `Delivery (${cur})`,
      `Commission (${cur})`,
      "Town",
      "Region",
    ],
    ...sorted.map((f: OrderFact) => {
      const commission = f.status === "cancelled" ? 0n : (f.subtotalPesewas * BigInt(bps(f.sellerId))) / 10_000n
      return [
        when(f.placedAt),
        orderReference(f.orderGroupId),
        ...(input.sellerId ? [] : [names.get(f.sellerId) ?? f.sellerId]),
        f.status,
        f.deliveredAt ? when(f.deliveredAt) : "",
        PAY_LABEL[f.paymentMethod ?? ""] ?? "",
        f.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery",
        f.items.map((i) => `${i.qty} × ${i.title}`).join("; "),
        major(f.subtotalPesewas),
        major(f.deliveryFeePesewas),
        major(commission),
        f.city ?? "",
        f.region ?? "",
      ]
    }),
  ]
  return { range, body: csv(rows) }
}

// ─── Statements ──────────────────────────────────────────────────────────

export type StatementView = {
  period: string
  status: "closed" | "open"
  closedAt: string | null
  hash: string | null
  /** Recomputed from the stored data just now — false means it was tampered with. */
  verified: boolean | null
  data: StatementData
}

/**
 * A month's statement. Past months are frozen on first read (and kept as
 * written forever); the current month is a live preview that isn't stored.
 */
export async function statementFor(c: C, scope: StatementScope, sellerId: string | null, period: string): Promise<StatementView> {
  const off = market().utcOffsetMinutes
  let bounds: { from: Date; to: Date }
  try {
    bounds = monthRange(period, off)
  } catch (err) {
    if (err instanceof BusinessRangeError) throw new HTTPException(400, { message: err.message })
    throw err
  }
  const now = new Date()
  if (bounds.from > now) throw new HTTPException(400, { message: "That month hasn't started yet." })
  const store = c.get("statements")
  const stored = await store.get(scope, sellerId, period)
  if (stored) {
    return { period, status: "closed", closedAt: stored.closedAt.toISOString(), hash: stored.hash, verified: (await statementHash(stored.data)) === stored.hash, data: stored.data }
  }
  const checkout = c.get("checkoutRepo")
  const [facts, payouts, bps] = await Promise.all([
    checkout.listOrderFacts({ sellerId: sellerId ?? undefined, deliveredFrom: bounds.from, deliveredTo: bounds.to }),
    checkout.listPayoutFacts({ sellerId: sellerId ?? undefined, paidFrom: bounds.from, paidTo: bounds.to }),
    commissionLookup(c),
  ])
  const data = buildStatement({ scope, sellerId, period, currency: market().currencyCode, facts, payouts, commissionBps: bps, utcOffsetMinutes: off })
  const hash = await statementHash(data)
  if (bounds.to > now) return { period, status: "open", closedAt: null, hash: null, verified: null, data }
  const frozen = await store.close({ scope, sellerId, period, data, hash })
  return { period, status: "closed", closedAt: frozen.closedAt.toISOString(), hash: frozen.hash, verified: (await statementHash(frozen.data)) === frozen.hash, data: frozen.data }
}

export function statementCsv(view: StatementView, names: Map<string, string>) {
  const cur = view.data.currency
  const t = view.data.totals
  const rows: unknown[][] = [
    ["Statement", view.data.scope === "platform" ? "Platform" : (names.get(view.data.sellerId ?? "") ?? view.data.sellerId), view.period],
    ["Status", view.status === "closed" ? `Closed ${view.closedAt ? when(view.closedAt) : ""}` : "Open (this month so far)"],
    ...(view.hash ? [["Fingerprint (SHA-256)", view.hash]] : []),
    [],
    ["Date", "Type", "Reference", ...(view.data.scope === "platform" ? ["Shop"] : []), "Payment", `Sales (${cur})`, `Delivery (${cur})`, `Commission (${cur})`, `Payout (${cur})`],
    ...view.data.lines.map((l) =>
      l.kind === "sale"
        ? [
            when(l.date),
            l.fulfillmentMethod === "pickup" ? "Sale (pickup)" : "Sale",
            l.orderRef,
            ...(view.data.scope === "platform" ? [names.get(l.sellerId) ?? l.sellerId] : []),
            PAY_LABEL[l.paymentMethod ?? ""] ?? "",
            major(l.salesPesewas),
            major(l.deliveryFeePesewas),
            major(l.commissionPesewas),
            "",
          ]
        : [when(l.date), "Payout", l.reference ?? l.payoutId, ...(view.data.scope === "platform" ? [names.get(l.sellerId) ?? l.sellerId] : []), "MoMo", "", "", "", major(l.netPesewas)],
    ),
    [],
    ["Delivered orders", t.deliveredOrders],
    [`Sales (${cur})`, major(t.salesPesewas)],
    [`Delivery fees (${cur})`, major(t.deliveryFeesPesewas)],
    [`Commission (${cur})`, major(t.commissionPesewas)],
    [`Earned from online payments (${cur})`, major(t.onlineEarnedPesewas)],
    [`Cash collected on delivery (${cur})`, major(t.cashCollectedPesewas)],
    [`Commission owed on cash sales (${cur})`, major(t.cashCommissionOwedPesewas)],
    [`Payouts paid (${cur})`, major(t.payoutsPaidPesewas)],
  ]
  return csv(rows)
}

/** Months to list: from the seller joining (or platform start) to this month, newest first. */
export function currentPeriod() {
  return monthOf(new Date(), market().utcOffsetMinutes)
}
