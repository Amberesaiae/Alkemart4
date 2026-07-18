import { evaluateSellable } from "../product-sellable"

describe("evaluateSellable", () => {
  const full = {
    product_status: "published",
    has_product_seller: true,
    seller_status: "open",
    seller_setup_complete: true,
    has_sales_channel: true,
    has_ghs_offer: true,
    has_shipping_profile: true,
    in_stock: true,
  }

  it("is sellable when all clauses pass", () => {
    const r = evaluateSellable(full)
    expect(r.sellable).toBe(true)
    expect(r.in_stock).toBe(true)
  })

  it("fails when not published", () => {
    expect(
      evaluateSellable({ ...full, product_status: "proposed" }).sellable,
    ).toBe(false)
  })

  it("fails when seller suspended", () => {
    expect(
      evaluateSellable({ ...full, seller_status: "suspended" }).sellable,
    ).toBe(false)
  })

  it("fails without offer", () => {
    expect(evaluateSellable({ ...full, has_ghs_offer: false }).sellable).toBe(
      false,
    )
  })

  it("allows unknown setup when seller_setup_complete undefined", () => {
    const { seller_setup_complete: _, ...rest } = full
    expect(evaluateSellable(rest).sellable).toBe(true)
  })
})
