import { describe, expect, it } from "vitest"
import {
  InvalidFulfillmentTransitionError,
  assertFulfillmentTransition,
  computePayoutBatch,
} from "../fulfillment"

describe("assertFulfillmentTransition", () => {
  it("allows placed→shipped→delivered", () => {
    assertFulfillmentTransition("placed", "shipped")
    assertFulfillmentTransition("shipped", "delivered")
  })

  it("rejects delivered→shipped", () => {
    expect(() => assertFulfillmentTransition("delivered", "shipped")).toThrow(
      InvalidFulfillmentTransitionError,
    )
  })
})

describe("computePayoutBatch", () => {
  it("applies commission_bps to subtotals", () => {
    const batch = computePayoutBatch("seller-a", 700, [
      { orderId: "o1", sellerId: "seller-a", subtotalPesewas: 10_000n },
      { orderId: "o2", sellerId: "seller-a", subtotalPesewas: 5_000n },
    ])
    // 7% of 15000 = 1050
    expect(batch.grossPesewas).toBe(15_000n)
    expect(batch.commissionPesewas).toBe(1_050n)
    expect(batch.netPesewas).toBe(13_950n)
    expect(batch.lines).toHaveLength(2)
  })
})
