import { describe, expect, it } from "vitest"
import {
  attributeSignature,
  scoreSimilarity,
  type SimilarProductInput,
} from "../similarity"

const base = (over: Partial<SimilarProductInput> & { productId: string }): SimilarProductInput => ({
  primaryCategoryId: "phones",
  productType: "smartphone",
  brand: "Tecno",
  pricePesewas: 10000n,
  attributes: new Map([
    ["storage", "n:128"],
    ["network", "o:5g"],
  ]),
  ...over,
})

describe("scoreSimilarity (Phase 8A)", () => {
  it("excludes the product itself", () => {
    const p = base({ productId: "p1" })
    expect(scoreSimilarity(p, p).score).toBe(-1)
  })
  it("scores category, type, brand, attributes, and price", () => {
    const { score, reasons } = scoreSimilarity(
      base({ productId: "p1" }),
      base({ productId: "p2" }),
    )
    // 3 category + 2 type + 1 brand + 2 shared attrs + 1 price = 9.
    expect(score).toBe(9)
    expect(reasons).toEqual([
      "same category",
      "same product type",
      "same brand",
      "2 shared attributes",
      "nearby price",
    ])
  })
  it("ranks closer matches above distant ones", () => {
    const source = base({ productId: "p1" })
    const close = scoreSimilarity(source, base({ productId: "p2" })).score
    const far = scoreSimilarity(
      source,
      base({
        productId: "p3",
        primaryCategoryId: "women",
        productType: "gown",
        brand: "Other",
        pricePesewas: 50000n,
        attributes: new Map(),
      }),
    ).score
    expect(close).toBeGreaterThan(far)
  })
  it("ignores unknown attribute values instead of matching them", () => {
    const { score } = scoreSimilarity(
      base({ productId: "p1", attributes: new Map([["storage", "n:?"]]) }),
      base({ productId: "p2", attributes: new Map([["other", "n:?"]]) }),
    )
    // category(3) + type(2) + brand(1) + price(1) = 7, no attribute points.
    expect(score).toBe(7)
  })
})

describe("attributeSignature (Phase 8A)", () => {
  it("normalizes option order and number formatting", () => {
    expect(attributeSignature("multi_option", { optionValues: ["5G", "4G"] })).toBe(
      attributeSignature("multi_option", { optionValues: ["4g", "5G"] }),
    )
    expect(attributeSignature("number", { numberValue: 128 })).toBe("n:128")
    expect(attributeSignature("boolean", { booleanValue: true })).toBe("b:true")
  })
})
