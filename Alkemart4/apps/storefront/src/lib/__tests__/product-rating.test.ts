import { describe, expect, it } from "vitest"
import { cardRating } from "../product-rating"

describe("cardRating", () => {
  it("hides the rating when nothing has been reviewed", () => {
    expect(cardRating(undefined, undefined)).toBeNull()
    expect(cardRating(null, null)).toBeNull()
    expect(cardRating(4.6, 0)).toBeNull()
    expect(cardRating(4.6, null)).toBeNull()
    expect(cardRating(null, 12)).toBeNull()
  })

  it("never renders a zero score as a rating", () => {
    expect(cardRating(0, 5)).toBeNull()
  })

  it("ignores non-finite averages rather than printing NaN", () => {
    expect(cardRating(Number.NaN, 3)).toBeNull()
    expect(cardRating(Number.POSITIVE_INFINITY, 3)).toBeNull()
  })

  it("shows one decimal place and the review count", () => {
    expect(cardRating(4.6, 12)).toEqual({
      value: "4.6",
      count: 12,
      label: "Rated 4.6 out of 5 from 12 reviews",
    })
  })

  it("does not round a partial score up to a whole star", () => {
    expect(cardRating(3.94, 8)?.value).toBe("3.9")
    expect(cardRating(5, 2)?.value).toBe("5.0")
  })

  it("says review, not reviews, for a lone review", () => {
    expect(cardRating(5, 1)?.label).toBe("Rated 5.0 out of 5 from 1 review")
  })
})
