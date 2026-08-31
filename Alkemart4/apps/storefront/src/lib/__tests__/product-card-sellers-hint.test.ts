import { describe, expect, it } from "vitest"
import { sellersHintText } from "../sellers-hint"

describe("sellersHintText", () => {
  it("hides hint when offerCount is 1 or missing", () => {
    expect(sellersHintText(undefined)).toBeNull()
    expect(sellersHintText(null)).toBeNull()
    expect(sellersHintText(1)).toBeNull()
    expect(sellersHintText(0)).toBeNull()
  })

  it("shows N sellers when offerCount > 1", () => {
    expect(sellersHintText(2)).toBe("2 sellers")
    expect(sellersHintText(5)).toBe("5 sellers")
  })
})
