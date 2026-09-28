import { describe, expect, it } from "vitest"
import { detailAvailableQty } from "../products"

describe("detailAvailableQty", () => {
  it("is zero when every active combination is out of stock", () => {
    expect(detailAvailableQty([{ availableQty: 0, active: true }])).toBe(0)
  })

  it("adds stock across active combinations only", () => {
    expect(detailAvailableQty([
      { availableQty: 3, active: true },
      { availableQty: 5, active: false },
      { availableQty: 2, active: true },
    ])).toBe(5)
  })

  it("stays unknown when the API sent no combinations", () => {
    expect(detailAvailableQty([])).toBeNull()
    expect(detailAvailableQty(undefined)).toBeNull()
  })
})
