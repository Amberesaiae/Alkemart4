import { describe, expect, it } from "vitest"
import { parseProductRef, slugifyTitle, toProductRef } from "../product-urls"

describe("slugifyTitle", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyTitle("Leather Sandals")).toBe("leather-sandals")
  })
  it("strips accents and punctuation", () => {
    expect(slugifyTitle("Men's Café-Style Shirt!")).toBe("men-s-cafe-style-shirt")
  })
  it("falls back to empty for untitled input", () => {
    expect(slugifyTitle("!!!")).toBe("")
  })
  it("caps length at 60 chars", () => {
    expect(slugifyTitle("a".repeat(100)).length).toBeLessThanOrEqual(60)
  })
})

describe("toProductRef", () => {
  const id = "b9e0be86-d2b2-4479-96c7-52eab2c15ec8"
  it("builds slug-id refs", () => {
    expect(toProductRef("Leather Sandals", id)).toBe(`leather-sandals-${id}`)
  })
  it("falls back to bare id when untitled", () => {
    expect(toProductRef("!!!", id)).toBe(id)
  })
})

describe("parseProductRef", () => {
  const id = "b9e0be86-d2b2-4479-96c7-52eab2c15ec8"
  it("splits slug-id compounds", () => {
    expect(parseProductRef(`leather-sandals-${id}`)).toEqual({ slug: "leather-sandals", id })
  })
  it("accepts bare ids", () => {
    expect(parseProductRef(id)).toEqual({ slug: null, id })
  })
  it("accepts bare slugs", () => {
    expect(parseProductRef("leather-sandals")).toEqual({ slug: "leather-sandals", id: null })
  })
  it("returns nulls for empty input", () => {
    expect(parseProductRef("  ")).toEqual({ slug: null, id: null })
  })
})
