import { describe, expect, it } from "vitest"
import { preferSellableProducts } from "../products"

describe("preferSellableProducts", () => {
  it("keeps only products with offerId when any exist", () => {
    const out = preferSellableProducts([
      { id: "1", offerId: null },
      { id: "2", offerId: "offer_a" },
      { id: "3", offerId: undefined },
    ])
    expect(out).toEqual([{ id: "2", offerId: "offer_a" }])
  })

  it("returns original list when no offerIds present (lab non-strict)", () => {
    const input = [
      { id: "1", offerId: null },
      { id: "2", offerId: null },
    ]
    expect(preferSellableProducts(input)).toEqual(input)
  })

  it("returns empty when strict and no offerIds (production honesty)", () => {
    const input = [
      { id: "1", offerId: null },
      { id: "2", offerId: undefined },
    ]
    expect(preferSellableProducts(input, { strict: true })).toEqual([])
  })
})
