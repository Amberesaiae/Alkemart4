import { describe, expect, it } from "vitest"
import { CompareRuleError, compareSelection, nextRefillAt, spendToken, walletNow } from "../compare"

const DAY = 86_400_000
const t0 = new Date("2026-10-01T09:00:00Z")

describe("compare tokens", () => {
  it("gives 5 on joining and tops back up to 5 after two weeks, never above", () => {
    const w = walletNow(null, t0)
    expect(w.balance).toBe(5)
    const used = spendToken(spendToken(w))
    expect(walletNow(used, new Date(t0.getTime() + 13 * DAY)).balance).toBe(3)
    const topped = walletNow(used, new Date(t0.getTime() + 14 * DAY))
    expect(topped.balance).toBe(5)
    expect(nextRefillAt(topped).getTime()).toBe(t0.getTime() + 28 * DAY)
    expect(walletNow({ balance: 5, refilledAt: t0 }, new Date(t0.getTime() + 30 * DAY)).balance).toBe(5)
  })

  it("refuses to spend at zero, in plain words", () => {
    expect(() => spendToken({ balance: 0, refilledAt: t0 })).toThrow(CompareRuleError)
  })

  it("compares 2 to 4 different products", () => {
    expect(compareSelection(["a", "b", "a"])).toEqual(["a", "b"])
    expect(() => compareSelection(["a"])).toThrow(/at least 2/)
    expect(() => compareSelection(["a", "b", "c", "d", "e"])).toThrow(/up to 4/)
  })
})
