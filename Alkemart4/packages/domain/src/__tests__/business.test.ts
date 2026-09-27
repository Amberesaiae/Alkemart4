import { describe, expect, it } from "vitest"
import {
  BusinessRangeError,
  buildStatement,
  canonicalJson,
  change,
  monthsBetween,
  previousRange,
  resolveRange,
  statementHash,
  summarize,
  type OrderFact,
} from "../business"

const d = (s: string) => new Date(s)
const now = d("2026-09-26T15:00:00Z")

const fact = (o: Partial<OrderFact> & { orderId: string; placedAt: Date }): OrderFact => ({
  orderGroupId: `g-${o.orderId}`,
  sellerId: "seller-a",
  status: "delivered",
  deliveredAt: o.placedAt,
  subtotalPesewas: 100_000n,
  deliveryFeePesewas: 3_000n,
  paymentMethod: "momo",
  fulfillmentMethod: "delivery",
  buyerKey: "ama@x.test",
  region: "Greater Accra",
  city: "Accra",
  items: [{ productId: "p1", title: "Tecno Spark", qty: 1, amountPesewas: o.subtotalPesewas ?? 100_000n }],
  ...o,
})

describe("resolveRange", () => {
  it("last 7 days ends tomorrow at local midnight and starts 6 days back", () => {
    const r = resolveRange({ preset: "7d" }, { now })
    expect(r.from).toEqual(d("2026-09-20T00:00:00Z"))
    expect(r.to).toEqual(d("2026-09-27T00:00:00Z"))
    expect(r.bucket).toBe("day")
  })
  it("follows the market's clock", () => {
    const r = resolveRange({ preset: "7d" }, { now, utcOffsetMinutes: 60 })
    expect(r.from).toEqual(d("2026-09-19T23:00:00Z"))
  })
  it("a calendar year, by month", () => {
    const r = resolveRange({ year: 2025 }, { now })
    expect([r.from, r.to, r.label, r.bucket]).toEqual([d("2025-01-01T00:00:00Z"), d("2026-01-01T00:00:00Z"), "2025", "month"])
  })
  it("last 12 months covers whole months", () => {
    const r = resolveRange({ preset: "12m" }, { now })
    expect([r.from, r.to]).toEqual([d("2025-10-01T00:00:00Z"), d("2026-10-01T00:00:00Z")])
  })
  it("since joining and custom dates (inclusive end)", () => {
    expect(resolveRange({ preset: "since_joined" }, { now, joinedAt: d("2024-03-10T09:00:00Z") }).from).toEqual(d("2024-03-10T00:00:00Z"))
    const r = resolveRange({ from: "2024-01-01", to: "2025-12-31" }, { now })
    expect([r.from, r.to, r.label]).toEqual([d("2024-01-01T00:00:00Z"), d("2026-01-01T00:00:00Z"), "1 Jan 2024 – 31 Dec 2025"])
  })
  it("refuses backwards, half, future-year and impossible ranges in plain words", () => {
    expect(() => resolveRange({ from: "2026-02-01", to: "2026-01-01" }, { now })).toThrow(BusinessRangeError)
    expect(() => resolveRange({ from: "2026-02-01" }, { now })).toThrow("Pick both")
    expect(() => resolveRange({ year: 2030 }, { now })).toThrow("up to this one")
    expect(() => resolveRange({ from: "26-2-1", to: "2026-03-01" }, { now })).toThrow("look like")
  })
  it("previous period is the same length just before", () => {
    const r = resolveRange({ preset: "30d" }, { now })
    const p = previousRange(r)
    expect(p.to).toEqual(r.from)
    expect(p.to.getTime() - p.from.getTime()).toBe(r.to.getTime() - r.from.getTime())
  })
})

describe("summarize", () => {
  const facts = [
    fact({ orderId: "1", placedAt: d("2026-09-20T10:00:00Z") }),
    fact({ orderId: "2", placedAt: d("2026-09-21T10:00:00Z"), paymentMethod: "cod", fulfillmentMethod: "pickup", subtotalPesewas: 50_000n, buyerKey: "kofi@x.test", region: "Ashanti" }),
    fact({ orderId: "3", placedAt: d("2026-09-22T10:00:00Z"), status: "cancelled" }),
    fact({ orderId: "4", placedAt: d("2026-08-01T10:00:00Z") }), // outside
    fact({ orderId: "5", placedAt: d("2026-09-25T10:00:00Z"), sellerId: "seller-b", buyerKey: "ama@x.test" }),
  ]
  const r = resolveRange({ preset: "7d" }, { now })
  const s = summarize(facts, r, { commissionBps: (id) => (id === "seller-b" ? 1000 : 700) })

  it("counts orders placed in range; cancelled only as cancelled", () => {
    expect([s.orders, s.cancelled, s.delivered]).toEqual([3, 1, 3])
    expect(s.salesPesewas).toBe(250_000n)
    expect(s.avgOrderPesewas).toBe(83_333n)
  })
  it("commission at each seller's own rate; take-home is the rest", () => {
    expect(s.commissionPesewas).toBe(7_000n + 3_500n + 10_000n)
    expect(s.takeHomePesewas).toBe(250_000n - 20_500n)
  })
  it("buyers, repeat buyers, pay-on-delivery and pickup shares", () => {
    expect([s.buyers, s.repeatBuyers]).toEqual([2, 1])
    expect(s.payOnDeliveryShare).toBeCloseTo(1 / 3)
    expect(s.pickupShare).toBeCloseTo(1 / 3)
  })
  it("a point per day with the sales in it; regions and sellers ranked", () => {
    expect(s.series).toHaveLength(7)
    expect(s.series.find((p) => p.key === "2026-09-21")).toMatchObject({ orders: 1, salesPesewas: 50_000n })
    expect(s.regions.map((x) => x.region)).toEqual(["Greater Accra", "Ashanti"])
    expect(s.sellers[0]).toMatchObject({ sellerId: "seller-a", orders: 2 })
  })
  it("change vs previous: fraction, or null when there was nothing", () => {
    expect(change(150n, 100n)).toBe(0.5)
    expect(change(5, 0)).toBeNull()
    expect(change(0, 0)).toBe(0)
  })
})

describe("monthly statements", () => {
  const facts = [
    fact({ orderId: "a", placedAt: d("2026-08-30T10:00:00Z"), deliveredAt: d("2026-09-02T10:00:00Z") }),
    fact({ orderId: "b", placedAt: d("2026-09-10T10:00:00Z"), deliveredAt: d("2026-09-11T10:00:00Z"), paymentMethod: "cod" }),
    fact({ orderId: "c", placedAt: d("2026-09-29T10:00:00Z"), deliveredAt: d("2026-10-01T09:00:00Z") }), // lands in October
    fact({ orderId: "d", placedAt: d("2026-09-12T10:00:00Z"), sellerId: "seller-b", deliveredAt: d("2026-09-13T10:00:00Z") }),
  ]
  const payouts = [
    { payoutId: "p1", sellerId: "seller-a", status: "paid", grossPesewas: 100_000n, commissionPesewas: 7_000n, netPesewas: 93_000n, paidAt: d("2026-09-05T10:00:00Z"), reference: "payout_1" },
    { payoutId: "p2", sellerId: "seller-a", status: "failed", grossPesewas: 1n, commissionPesewas: 0n, netPesewas: 1n, paidAt: null, reference: "payout_2" },
  ]
  const base = { period: "2026-09", currency: "GHS", facts, payouts, commissionBps: () => 700 }

  it("dates sales by delivery and payouts by payment", () => {
    const st = buildStatement({ ...base, scope: "seller", sellerId: "seller-a" })
    expect(st.lines.map((l) => ("orderId" in l ? l.orderId : l.payoutId))).toEqual(["a", "p1", "b"])
    expect(st.totals).toMatchObject({
      deliveredOrders: 2,
      salesPesewas: "200000",
      commissionPesewas: "14000",
      onlineEarnedPesewas: "93000",
      cashCollectedPesewas: "103000",
      cashCommissionOwedPesewas: "7000",
      payoutsPaidPesewas: "93000",
    })
  })
  it("the platform statement covers every seller", () => {
    const st = buildStatement({ ...base, scope: "platform", sellerId: null })
    expect(st.totals.deliveredOrders).toBe(3)
  })
  it("hashes the same data the same way, whatever the key order", async () => {
    const st = buildStatement({ ...base, scope: "seller", sellerId: "seller-a" })
    const { lines, totals, ...rest } = st
    const shuffled = JSON.parse(JSON.stringify({ totals, lines, ...rest }))
    expect(await statementHash(shuffled)).toBe(await statementHash(st))
    expect(await statementHash({ ...st, totals: { ...st.totals, salesPesewas: "1" } })).not.toBe(await statementHash(st))
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}')
  })
  it("lists months from joining to now, newest first", () => {
    expect(monthsBetween(d("2025-11-15T00:00:00Z"), d("2026-02-03T00:00:00Z"))).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"])
  })
})
