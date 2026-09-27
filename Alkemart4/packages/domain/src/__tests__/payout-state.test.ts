import { describe, expect, it } from "vitest"
import { canMovePayout, payoutStatusFromTransfer } from "../payout-state"

describe("payout state", () => {
  it("allows only forward moves", () => {
    expect(canMovePayout("pending", "processing")).toBe(true)
    expect(canMovePayout("processing", "paid")).toBe(true)
    expect(canMovePayout("paid", "reversed")).toBe(true)
    expect(canMovePayout("paid", "failed")).toBe(false)
    expect(canMovePayout("failed", "paid")).toBe(false)
    expect(canMovePayout("reversed", "paid")).toBe(false)
  })
  it("maps Paystack transfer statuses", () => {
    expect(payoutStatusFromTransfer("success")).toBe("paid")
    expect(payoutStatusFromTransfer("failed")).toBe("failed")
    expect(payoutStatusFromTransfer("reversed")).toBe("reversed")
    expect(payoutStatusFromTransfer("pending")).toBe("processing")
    expect(payoutStatusFromTransfer("otp")).toBeNull()
  })
})
