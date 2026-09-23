import { describe, expect, it } from "vitest"
import { searchFrom } from "./catalog-repository"
import { demoCatalog } from "./demo-seed"

/**
 * Pins the trigram contract (agnostic plan Phase 5): when rankedIds arrive
 * pre-ranked from the database, token scoring must NOT filter or reorder —
 * typo matches score 0 on exact tokens, and dropping them would delete the
 * entire point of trigram search.
 */
describe("searchFrom rankedIds", () => {
  it("preserves database ranking even when token scores disagree", () => {
    const data = demoCatalog()
    data.products.push({
      id: "prod-unrelated",
      title: "Leather Sandal",
      description: null,
      status: "published",
      primaryCategoryId: "phones",
      sellerId: "seller-a",
    })
    data.offers.push({
      id: "offer-unrelated",
      sellerId: "seller-a",
      productId: "prod-unrelated",
      variantId: "var-tecno-spark",
      pricePesewas: 900n,
      onHand: 5,
      reserved: 0,
      currency: "GHS",
      active: true,
    })
    // q matches only the Tecno by tokens — but the database ranked the
    // sandal first (e.g. typo "tecno" ~ "tenor"?). Order must follow rankedIds.
    const result = searchFrom(data, {
      q: "tecno",
      limit: 20,
      offset: 0,
      rankedIds: ["prod-unrelated", "prod-tecno-spark"],
    })
    expect(result.items.map((c) => c.productId)).toEqual([
      "prod-unrelated",
      "prod-tecno-spark",
    ])
    expect(result.total).toBe(2)
  })

  it("without rankedIds the token path still filters non-matches", () => {
    const data = demoCatalog()
    const result = searchFrom(data, { q: "tecno", limit: 20, offset: 0 })
    expect(result.items.map((c) => c.productId)).toEqual(["prod-tecno-spark"])
  })
})
