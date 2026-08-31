import { describe, expect, it } from "vitest"
import { evaluateSellerReadiness } from "../seller-readiness"

const ready = {
  name: "Ama's Shop",
  packRegion: "GH07",
  recipientCode: "RCP_test",
}

describe("evaluateSellerReadiness", () => {
  it("is not ready when name, pack region, and recipient_code are missing", () => {
    expect(evaluateSellerReadiness({})).toEqual({
      ready: false,
      missing: ["name", "region", "recipient_code"],
    })
  })

  it("requires a non-empty profile name", () => {
    expect(evaluateSellerReadiness({ ...ready, name: "  " }).missing).toContain("name")
  })

  it("requires a Ghana pack address region id", () => {
    expect(evaluateSellerReadiness({ ...ready, packRegion: "Greater Accra" }).missing).toContain(
      "region",
    )
    expect(evaluateSellerReadiness({ ...ready, packRegion: "" }).missing).toContain("region")
  })

  it("requires Paystack recipient_code unless lab skip flag is set", () => {
    expect(evaluateSellerReadiness({ ...ready, recipientCode: null }).missing).toContain(
      "recipient_code",
    )
    expect(
      evaluateSellerReadiness({
        name: ready.name,
        packRegion: ready.packRegion,
        skipPaystackRecipient: true,
      }),
    ).toEqual({ ready: true, missing: [] })
  })

  it("is ready when name, Ghana region, and recipient_code are set", () => {
    expect(evaluateSellerReadiness(ready)).toEqual({ ready: true, missing: [] })
  })
})
