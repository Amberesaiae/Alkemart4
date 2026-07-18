import {
  composeMercurReason,
  PRODUCT_REASON_CODES,
  SELLER_REASON_CODES,
} from "../moderation-reasons"

describe("composeMercurReason", () => {
  it("composes seller reject reason", () => {
    expect(composeMercurReason("policy")).toMatch(/^\[policy\]/)
    expect(composeMercurReason("other", "Custom note")).toBe(
      "[other] Custom note",
    )
  })

  it("composes product message with product catalog", () => {
    expect(
      composeMercurReason("poor_images", null, PRODUCT_REASON_CODES),
    ).toMatch(/^\[poor_images\]/)
  })

  it("exposes reason catalogs", () => {
    expect(SELLER_REASON_CODES.length).toBeGreaterThan(2)
    expect(PRODUCT_REASON_CODES.some((c) => c.code === "poor_images")).toBe(
      true,
    )
  })
})
