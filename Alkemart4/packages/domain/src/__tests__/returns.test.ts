import { describe, expect, it } from "vitest"
import {
  DEFAULT_RETURN_POLICY as P,
  ReturnRuleError,
  assertCanAskForReturn,
  dueReturnAction,
  nextReturnStep,
  refundShares,
  returnOptions,
  type ReturnCaseState,
} from "../returns"

const DAY = 86_400_000
const delivered = new Date("2026-09-01T10:00:00Z")
const base = {
  status: "delivered",
  deliveredAt: delivered,
  deliveryConfirmedBy: "buyer_code" as const,
  paidOnline: true,
  subtotalMinor: 185_000n,
  refundedMinor: 0n,
  shopReturnDays: 3,
}
const at = (days: number) => new Date(delivered.getTime() + days * DAY)
const reasons = (o: typeof base | Record<string, unknown>, d: number) => returnOptions(o as typeof base, at(d), P).map((r) => r.reason)

describe("returnOptions", () => {
  it("change of mind only within the shop's days; faults at least the platform window", () => {
    expect(reasons(base, 2)).toEqual(["damaged", "wrong_item", "not_as_described", "changed_mind"])
    expect(reasons(base, 5)).toEqual(["damaged", "wrong_item", "not_as_described"])
    expect(reasons(base, 8)).toEqual([])
  })
  it("a shop with 0 days takes no change-of-mind returns but still faults", () => {
    expect(reasons({ ...base, shopReturnDays: 0 }, 1)).not.toContain("changed_mind")
    expect(reasons({ ...base, shopReturnDays: 0 }, 1)).toContain("damaged")
  })
  it("uses the platform default when the shop set none, and a longer shop window for faults", () => {
    expect(reasons({ ...base, shopReturnDays: null }, 6)).toContain("changed_mind")
    expect(reasons({ ...base, shopReturnDays: 14 }, 10)).toContain("damaged")
  })
  it("returns start only after delivery", () => {
    expect(reasons({ ...base, status: "shipped", deliveredAt: null }, 1)).toEqual([])
  })
  it("nothing once fully refunded; COD counts as paid once delivered", () => {
    expect(reasons({ ...base, refundedMinor: 185_000n }, 1)).toEqual([])
    expect(reasons({ ...base, paidOnline: false }, 1)).toContain("damaged")
  })
  it("explains refusals in plain words", () => {
    expect(() => assertCanAskForReturn({ ...base, shopReturnDays: 0 }, "changed_mind", at(1), P)).toThrow(/doesn't take returns/)
    expect(() => assertCanAskForReturn(base, "damaged", at(30), P)).toThrow(/passed/)
    expect(() => assertCanAskForReturn({ ...base, status: "placed", deliveredAt: null, paidOnline: false }, "damaged", at(0), P)).toThrow(ReturnRuleError)
  })
})

const now = at(1)
const open = (o: Partial<ReturnCaseState> = {}): ReturnCaseState => ({ status: "requested", wish: "refund", respondBy: new Date(now.getTime() + 48 * 3_600_000), refundableMinor: 185_000n, ...o })

describe("nextReturnStep", () => {
  it("seller refunds in full or sends a replacement, whatever the buyer asked for", () => {
    expect(nextReturnStep(open(), { by: "seller", type: "refund" }, now)).toMatchObject({ status: "closed", outcome: "refund", refundMinor: 185_000n })
    expect(nextReturnStep(open(), { by: "seller", type: "replace" }, now)).toMatchObject({ outcome: "swap", refundMinor: 0n })
    expect(nextReturnStep(open({ wish: "swap" }), { by: "seller", type: "refund" }, now)).toMatchObject({ outcome: "refund" })
  })
  it("a decline needs a reason; the buyer accepts it or asks alkemart", () => {
    expect(() => nextReturnStep(open(), { by: "seller", type: "decline", reason: "no" }, now)).toThrow(/why/)
    const d = nextReturnStep(open(), { by: "seller", type: "decline", reason: "It was sealed when it left" }, now)
    expect(d.status).toBe("declined")
    expect(nextReturnStep(open({ status: "declined" }), { by: "buyer", type: "accept" }, now)).toMatchObject({ outcome: "declined" })
    expect(nextReturnStep(open({ status: "declined" }), { by: "buyer", type: "escalate" }, now).status).toBe("escalated")
  })
  it("buyer can't escalate while the seller still has time", () => {
    expect(() => nextReturnStep(open(), { by: "buyer", type: "escalate" }, now)).toThrow(/still has time/)
  })
  it("admin decides only escalated cases: full refund or side with the seller", () => {
    expect(() => nextReturnStep(open(), { by: "admin", type: "decide", outcome: "refund", note: "fair enough" }, now)).toThrow(/couldn't settle/)
    const esc = open({ status: "escalated", respondBy: null })
    expect(nextReturnStep(esc, { by: "admin", type: "decide", outcome: "refund", note: "Photos show a crack" }, now)).toMatchObject({ outcome: "refund", refundMinor: 185_000n })
    expect(nextReturnStep(esc, { by: "admin", type: "decide", outcome: "declined", note: "No proof of damage" }, now)).toMatchObject({ outcome: "declined", refundMinor: 0n })
  })
  it("deadlines: silent seller → admin", () => {
    const late = new Date(now.getTime() + 49 * 3_600_000)
    expect(dueReturnAction(open(), now)).toBeNull()
    expect(nextReturnStep(open(), dueReturnAction(open(), late)!, late).status).toBe("escalated")
    // A decline has no deadline: it waits for the buyer.
    expect(dueReturnAction(open({ status: "declined", respondBy: null }), late)).toBeNull()
    expect(dueReturnAction(open({ status: "escalated", respondBy: null }), late)).toBeNull()
  })
  it("acting on a closed case says it moved on", () => {
    expect(() => nextReturnStep(open({ status: "closed" }), { by: "seller", type: "refund" }, now)).toThrow(/moved on/)
  })
})

describe("money and policy", () => {
  it("splits a refund like payouts round commission", () => {
    expect(refundShares(185_000n, 1_000)).toEqual({ sellerMinor: 166_500n, platformMinor: 18_500n })
    expect(refundShares(99n, 1_000)).toEqual({ sellerMinor: 90n, platformMinor: 9n })
  })
})

import { applyRecoveries, payableSubtotal } from "../returns"
describe("payout recoveries", () => {
  it("applies what fits, oldest first, never below zero", () => {
    const r = applyRecoveries(100n, [{ id: "a", amountMinor: 60n }, { id: "b", amountMinor: 50n }, { id: "c", amountMinor: 40n }])
    expect(r.applied.map((x) => x.id)).toEqual(["a", "c"])
    expect(r.totalMinor).toBe(100n)
    expect(applyRecoveries(10n, [{ id: "a", amountMinor: 60n }]).totalMinor).toBe(0n)
  })
  it("payable subtotal drops by refunds, floored at zero", () => {
    expect(payableSubtotal({ subtotalPesewas: 100n, refundedPesewas: 30n })).toBe(70n)
    expect(payableSubtotal({ subtotalPesewas: 100n, refundedPesewas: 130n })).toBe(0n)
    expect(payableSubtotal({ subtotalPesewas: 100n })).toBe(100n)
  })
})
