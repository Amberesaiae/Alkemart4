import { sellerIdFromEvent } from "../seller-readiness-invalidate"

describe("sellerIdFromEvent", () => {
  it("returns null for undefined event", () => {
    expect(sellerIdFromEvent(undefined)).toBeNull()
  })

  it("returns null when data is empty", () => {
    expect(sellerIdFromEvent({ name: "seller.updated", data: {} })).toBeNull()
  })

  it("prefers id", () => {
    expect(
      sellerIdFromEvent({ name: "seller.updated", data: { id: "sel_1", seller_id: "sel_2" } }),
    ).toBe("sel_1")
  })

  it("falls back to seller_id", () => {
    expect(
      sellerIdFromEvent({ name: "seller.approved", data: { seller_id: "sel_y" } }),
    ).toBe("sel_y")
  })

  it("trims whitespace", () => {
    expect(
      sellerIdFromEvent({ name: "seller.updated", data: { id: "  sel_z  " } }),
    ).toBe("sel_z")
  })

  it("returns null for blank/whitespace-only id", () => {
    expect(
      sellerIdFromEvent({ name: "seller.updated", data: { id: "   " } }),
    ).toBeNull()
  })
})
