import { describe, expect, it } from "vitest"
import { DEFAULT_DEAL_POLICY as P, checkFloor, dealPriceFor, judgeBuyerOffer, nextDealStep, parseDealPolicy, type DealState } from "../deals"

const base = { priceMinor: 185_000n, amountMinor: 170_000n, qty: 1, available: 3, negotiable: true, floorMinor: 160_000n, openByBuyer: 0 }
describe("judgeBuyerOffer", () => {
  it("sends a fair offer; auto-declines under the hidden floor", () => {
    expect(judgeBuyerOffer(base).verdict).toBe("send")
    expect(judgeBuyerOffer({ ...base, amountMinor: 150_000n }).verdict).toBe("auto_decline")
    expect(judgeBuyerOffer({ ...base, floorMinor: null, amountMinor: 100_000n }).verdict).toBe("send")
  })
  it("refuses what isn't a real offer, in plain words", () => {
    expect(() => judgeBuyerOffer({ ...base, negotiable: false })).toThrow(/fixed prices/)
    expect(() => judgeBuyerOffer({ ...base, amountMinor: 185_000n })).toThrow(/just buy it/)
    expect(() => judgeBuyerOffer({ ...base, amountMinor: 90_000n })).toThrow(/too low/)
    expect(() => judgeBuyerOffer({ ...base, qty: 4 })).toThrow(/Only 3 left/)
    expect(() => judgeBuyerOffer({ ...base, openByBuyer: 5 })).toThrow(/too many/)
  })
  it("floor must sit below the price", () => {
    expect(checkFloor(190_000n, 185_000n)).toMatch(/below/)
    expect(checkFloor(null, 185_000n)).toBeNull()
  })
})

const now = new Date("2026-09-26T10:00:00Z")
const pending: DealState = { status: "pending", amountMinor: 170_000n, counterMinor: null, priceMinor: 185_000n, respondBy: new Date(now.getTime() + 3_600_000) }
describe("nextDealStep", () => {
  it("accept holds the price for the valid window", () => {
    const s = nextDealStep(pending, { by: "seller", type: "accept" }, now)
    expect(s).toMatchObject({ status: "accepted", agreedMinor: 170_000n })
    expect(s.validUntil!.getTime() - now.getTime()).toBe(P.validHours * 3_600_000)
  })
  it("counter must sit between the offer and the price; buyer accepts the counter", () => {
    expect(() => nextDealStep(pending, { by: "seller", type: "counter", amountMinor: 160_000n }, now)).toThrow(/above the buyer/)
    expect(() => nextDealStep(pending, { by: "seller", type: "counter", amountMinor: 185_000n }, now)).toThrow(/below your listed/)
    const c = nextDealStep(pending, { by: "seller", type: "counter", amountMinor: 178_000n }, now)
    expect(c.status).toBe("countered")
    expect(nextDealStep({ ...pending, status: "countered", counterMinor: 178_000n }, { by: "buyer", type: "accept" }, now)).toMatchObject({ status: "accepted", agreedMinor: 178_000n })
  })
  it("expires after the deadline, not before", () => {
    expect(() => nextDealStep(pending, { by: "system", type: "expire" }, now)).toThrow()
    expect(nextDealStep(pending, { by: "system", type: "expire" }, new Date(now.getTime() + 2 * 3_600_000)).status).toBe("expired")
  })
})

describe("dealPriceFor", () => {
  const d = { status: "accepted" as const, agreedMinor: 170_000n, validUntil: new Date(now.getTime() + 3_600_000), qty: 1, buyerUserId: "b1", offerId: "o1" }
  it("applies only to that buyer, listing and quantity, while valid", () => {
    expect(dealPriceFor(d, { buyerUserId: "b1", offerId: "o1", qty: 1 }, now)).toBe(170_000n)
    expect(dealPriceFor(d, { buyerUserId: "b2", offerId: "o1", qty: 1 }, now)).toBeNull()
    expect(dealPriceFor(d, { buyerUserId: "b1", offerId: "o1", qty: 2 }, now)).toBeNull()
    expect(dealPriceFor(d, { buyerUserId: "b1", offerId: "o1", qty: 1 }, new Date(now.getTime() + 2 * 3_600_000))).toBeNull()
    expect(dealPriceFor({ ...d, status: "used" }, { buyerUserId: "b1", offerId: "o1", qty: 1 }, now)).toBeNull()
  })
  it("policy validation", () => {
    expect(parseDealPolicy({ validHours: 0 })).toMatchObject({ ok: false })
  })
})
