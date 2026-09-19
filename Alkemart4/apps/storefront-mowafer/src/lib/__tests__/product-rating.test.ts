import { describe, expect, it } from "vitest"
import { formatRating } from "../product-rating"

describe("formatRating", () => {
  it("formats rating only when count > 0", () => {
    expect(formatRating(4.9, 0)).toBeNull()
    expect(formatRating(4.9, 38)).toMatch(/4\.9/)
    expect(formatRating(4.9, 38)).toMatch(/38/)
  })
})
