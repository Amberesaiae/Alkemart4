import { describe, it, expect } from "vitest"
import { addMoney, asCurrencyCode, asMoney, asPesewas, assertSameCurrency, feeFor, zeroMoney } from "../money"

describe("asPesewas", () => {
  it("accepts integer bigint", () => {
    expect(asPesewas(2500n)).toBe(2500n)
  })
  it("rejects fractional number", () => {
    expect(() => asPesewas(12.5)).toThrow(/pesewas/i)
  })
  it("rejects negative", () => {
    expect(() => asPesewas(-1)).toThrow(/pesewas/i)
  })
})

describe("Money (currency-agnostic)", () => {
  it("normalizes currency codes to ISO-4217", () => {
    expect(asCurrencyCode("GHS")).toBe("GHS")
    expect(asCurrencyCode(" USD ")).toBe("USD")
    expect(() => asCurrencyCode("GH")).toThrow(/ISO-4217/)
    expect(() => asCurrencyCode("USDD")).toThrow(/ISO-4217/)
  })

  it("adds same-currency amounts and rejects mixed", () => {
    const total = addMoney(asMoney(1000n, "GHS"), asMoney(500n, "GHS"))
    expect(total).toEqual({ amountMinor: 1500n, currency: "GHS" })
    expect(() => assertSameCurrency(asMoney(1n, "GHS"), asMoney(1n, "USD"))).toThrow(/mismatch/)
    expect(() => addMoney(asMoney(1n, "GHS"), asMoney(1n, "USD"))).toThrow(/mismatch/)
  })

  it("computes platform fees in integer minor units", () => {
    expect(feeFor(asMoney(45000n, "GHS"), 700)).toEqual({ amountMinor: 3150n, currency: "GHS" })
    expect(feeFor(asMoney(1n, "GHS"), 700).amountMinor).toBe(0n)
    expect(() => feeFor(asMoney(1n, "GHS"), 10_001)).toThrow(/basis points/)
  })

  it("builds zero amounts per currency", () => {
    expect(zeroMoney("usd")).toEqual({ amountMinor: 0n, currency: "USD" })
  })
})
