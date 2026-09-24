import { describe, expect, it } from "vitest"
import { facetSplitQuality, orderFacets, prunedValues, type FacetGroup } from "../facet-quality"

describe("facetSplitQuality", () => {
  it("scores an even split highest", () => {
    expect(facetSplitQuality({ a: 50, b: 50 })).toBeCloseTo(1, 5)
  })
  it("scores a lopsided split low", () => {
    // 95% in one value teaches the buyer almost nothing.
    expect(facetSplitQuality({ a: 95, b: 5 })).toBeLessThan(0.3)
  })
  it("scores a single value zero — the filter cannot change anything", () => {
    expect(facetSplitQuality({ only: 42 })).toBe(0)
    expect(facetSplitQuality({})).toBe(0)
  })
  it("is comparable across facets of different cardinality", () => {
    const two = facetSplitQuality({ a: 50, b: 50 })
    const forty = facetSplitQuality(Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`v${i}`, 10]),
    ))
    expect(two).toBeCloseTo(forty, 5)
  })
})

describe("orderFacets", () => {
  const groups: FacetGroup[] = [
    { code: "lopsided", label: "Lopsided", values: { a: 95, b: 5 } },
    { code: "even", label: "Even", values: { a: 50, b: 50 } },
    { code: "useless", label: "Useless", values: { only: 20 } },
  ]

  it("puts the most informative facet first and drops single-value ones", () => {
    expect(orderFacets(groups).map((g) => g.code)).toEqual(["even", "lopsided"])
  })

  it("pins a facet the buyer has already used, even as its score collapses", () => {
    // Narrowing with a facet drives its own score down; reordering it away
    // from under the cursor is disorienting.
    const out = orderFacets(groups, { lopsided: ["a"] })
    expect(out[0].code).toBe("lopsided")
  })

  it("keeps a selected single-value facet visible so it can be undone", () => {
    expect(orderFacets(groups, { useless: ["only"] }).map((g) => g.code)).toContain("useless")
  })
})

describe("prunedValues", () => {
  it("drops unreachable values and orders by count", () => {
    expect(prunedValues({ a: 3, gone: 0, b: 9 })).toEqual([["b", 9], ["a", 3]])
  })
  it("keeps a zero-count value the buyer has selected, so they can clear it", () => {
    expect(prunedValues({ a: 3, gone: 0 }, ["gone"])).toEqual([["a", 3], ["gone", 0]])
  })
})
