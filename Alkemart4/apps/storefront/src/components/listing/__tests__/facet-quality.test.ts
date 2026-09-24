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
    // One value covering 20 of 100 — it still narrows, so it is not dead.
    { code: "subset", label: "Subset", values: { only: 20 } },
  ]

  it("orders by how evenly a facet splits the set", () => {
    // `subset` scores 0 on entropy (one value) but still narrows, so it ranks
    // last rather than being dropped.
    expect(orderFacets(groups, {}, 100).map((g) => g.code)).toEqual([
      "even",
      "lopsided",
      "subset",
    ])
  })

  it("keeps a single-value facet that still narrows the set", () => {
    // 3 results, 1 tagged Leather: picking it narrows 3 -> 1. The old rule
    // ("more than one value") hid this and made small catalogues look broken.
    const one: FacetGroup[] = [{ code: "material", label: "Material", values: { Leather: 1 } }]
    expect(orderFacets(one, {}, 3).map((g) => g.code)).toEqual(["material"])
  })

  it("drops a facet whose one value every result already shares", () => {
    const all: FacetGroup[] = [{ code: "material", label: "Material", values: { Leather: 3 } }]
    expect(orderFacets(all, {}, 3)).toEqual([])
  })

  it("pins a facet the buyer has already used, even as its score collapses", () => {
    // Narrowing with a facet drives its own score down; reordering it away
    // from under the cursor is disorienting.
    const out = orderFacets(groups, { lopsided: ["a"] }, 100)
    expect(out[0].code).toBe("lopsided")
  })

  it("keeps a selected facet visible even when it can no longer narrow", () => {
    expect(orderFacets(groups, { subset: ["only"] }, 100).map((g) => g.code)).toContain("subset")
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
