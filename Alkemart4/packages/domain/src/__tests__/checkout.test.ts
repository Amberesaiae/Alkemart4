import { describe, expect, it } from "vitest"
import {
  InvalidPaymentTransitionError,
  assertPaymentTransition,
  quoteCart,
} from "../checkout"

describe("quoteCart", () => {
  it("groups by seller and charges delivery once per seller", () => {
    const quote = quoteCart([
      {
        offerId: "o1",
        sellerId: "s1",
        qty: 2,
        unitPricePesewas: 1000n,
        deliveryFeePesewas: 500n,
      },
      {
        offerId: "o2",
        sellerId: "s1",
        qty: 1,
        unitPricePesewas: 300n,
        deliveryFeePesewas: 500n,
      },
      {
        offerId: "o3",
        sellerId: "s2",
        qty: 1,
        unitPricePesewas: 2000n,
        deliveryFeePesewas: 800n,
      },
    ])

    expect(quote.sellers).toHaveLength(2)
    const s1 = quote.sellers.find((s) => s.sellerId === "s1")!
    const s2 = quote.sellers.find((s) => s.sellerId === "s2")!
    expect(s1.subtotalPesewas).toBe(2300n)
    expect(s1.deliveryFeePesewas).toBe(500n)
    expect(s1.sellerTotalPesewas).toBe(2800n)
    expect(s2.sellerTotalPesewas).toBe(2800n)
    expect(quote.totalPesewas).toBe(5600n)
    expect(quote.currency).toBe("ghs")
  })
})

describe("assertPaymentTransition", () => {
  it("allows MoMo path initiated→pending→succeeded→completed", () => {
    assertPaymentTransition("initiated", "pending")
    assertPaymentTransition("pending", "succeeded")
    assertPaymentTransition("succeeded", "completed")
  })

  it("allows COD initiated→completed", () => {
    assertPaymentTransition("initiated", "completed")
  })

  it("rejects completed→pending", () => {
    expect(() => assertPaymentTransition("completed", "pending")).toThrow(
      InvalidPaymentTransitionError,
    )
  })
})
