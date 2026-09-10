import { describe, expect, it } from "vitest"
import { flagCatalogProduct, flaggingContext } from "./moderation-flags"

const BASE = {
  id: "p-1",
  title: "Tecno Spark 20",
  description: "Budget Android phone",
  imageUrl: "http://x/i.webp",
  primaryCategoryId: "phones",
  sellerId: "seller-1",
}

function ctx() {
  return flaggingContext(
    [
      { ...BASE, status: "proposed" },
      { id: "p-2", title: "Tecno Spark 20", status: "published", primaryCategoryId: "phones", sellerId: "seller-2" },
    ],
    [
      { productId: "p-1", pricePesewas: 159900n, onHand: 3, active: true },
      { productId: "p-2", pricePesewas: 160000n, onHand: 2, active: true },
      { productId: "p-3", pricePesewas: 161000n, onHand: 1, active: true },
    ],
  )
}

describe("flagCatalogProduct", () => {
  it("passes a clean listing", () => {
    // Median needs ≥3 samples; only p-1's own offer qualifies here plus two
    // orphan offers (no matching product → excluded from its category).
    expect(flagCatalogProduct(BASE, ctx()).filter((f) => f.rule !== "duplicate-title")).toEqual([])
  })

  it("flags missing images", () => {
    const flags = flagCatalogProduct({ ...BASE, imageUrl: null }, ctx())
    expect(flags.map((f) => f.rule)).toContain("no-image")
  })

  it("flags banned phrases", () => {
    const flags = flagCatalogProduct({ ...BASE, title: "Genuine Rolex cheap, whatsapp me" }, ctx())
    expect(flags.map((f) => f.rule)).toContain("banned-words")
  })

  it("flags duplicate live titles from other sellers", () => {
    const flags = flagCatalogProduct(BASE, ctx())
    expect(flags.map((f) => f.rule)).toContain("duplicate-title")
  })

  it("flags price outliers against the category median", () => {
    const c = flaggingContext(
      [{ ...BASE, status: "proposed" }],
      [
        { productId: "p-1", pricePesewas: 1_000_000n, onHand: 1, active: true },
        { productId: "x", pricePesewas: 100_000n, onHand: 1, active: true },
        { productId: "y", pricePesewas: 100_000n, onHand: 1, active: true },
        { productId: "z", pricePesewas: 100_000n, onHand: 1, active: true },
      ],
    )
    // Median over p-1's own category bucket needs ≥3 samples in-category;
    // orphan offers lack a product row so only p-1 counts → no median → no flag.
    expect(flagCatalogProduct({ ...BASE }, c).map((f) => f.rule)).not.toContain("price-outlier")

    const c2 = flaggingContext(
      [
        { ...BASE, status: "proposed" },
        { id: "a", title: "A", status: "published", primaryCategoryId: "phones", sellerId: "s-a" },
        { id: "b", title: "B", status: "published", primaryCategoryId: "phones", sellerId: "s-b" },
        { id: "c", title: "C", status: "published", primaryCategoryId: "phones", sellerId: "s-c" },
      ],
      [
        { productId: "p-1", pricePesewas: 1_000_000n, onHand: 1, active: true },
        { productId: "a", pricePesewas: 100_000n, onHand: 1, active: true },
        { productId: "b", pricePesewas: 100_000n, onHand: 1, active: true },
        { productId: "c", pricePesewas: 100_000n, onHand: 1, active: true },
      ],
    )
    expect(flagCatalogProduct({ ...BASE }, c2).map((f) => f.rule)).toContain("price-outlier")
  })
})
