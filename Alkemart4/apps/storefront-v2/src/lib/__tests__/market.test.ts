import { describe, expect, it } from "vitest"
import { formatMoney, getActiveMarket, listMarkets } from "../market"

describe("storefront market", () => {
  it("defaults to a market from the shared table, not a literal", () => {
    const m = getActiveMarket()
    expect(listMarkets().map((x) => x.code)).toContain(m.code)
    expect(m.regions.length).toBeGreaterThan(0)
    expect(m.address.fields.some((f) => f.required)).toBe(true)
  })

  it("formats money with the market symbol and never invents a value", () => {
    const m = getActiveMarket()
    expect(formatMoney(8499, m.currency.code)).toContain(m.currency.symbol)
    expect(formatMoney(8499, m.currency.code)).toContain("8,499.00")
    expect(formatMoney(8499, null, { compact: true })).not.toContain(".00")
    expect(formatMoney(null)).toBe("—")
  })

  it("keeps foreign currencies in their own code", () => {
    expect(formatMoney(10, "usd")).toMatch(/US\$|\$|USD/)
  })

  it("every mobile-money network is a checkout provider the API accepts", () => {
    for (const net of getActiveMarket().mobileMoney) {
      expect(["mtn", "vodafone", "airteltigo"]).toContain(net.id)
    }
  })
})
