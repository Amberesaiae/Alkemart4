import { describe, expect, it } from "vitest"
import {
  EMPTY_FACETS,
  activeFacetCount,
  appliedFacets,
  filterListingByRating,
  resetFacets,
  sortListingProducts,
  type ListingFacetState,
} from "@/components/listing/ListingFacets"

const base: ListingFacetState = { ...EMPTY_FACETS }

describe("appliedFacets", () => {
  it("is empty for untouched facets", () => {
    expect(appliedFacets(base)).toEqual([])
    expect(activeFacetCount(base)).toBe(0)
  })

  it("counts one chip per seller, not one per group", () => {
    const s = { ...base, sellerHandles: ["kofi", "ama"] }
    expect(activeFacetCount(s)).toBe(2)
  })

  it("treats a price range as a single removable chip", () => {
    const s = { ...base, priceMin: 10, priceMax: 90 }
    const chips = appliedFacets(s)
    expect(chips).toHaveLength(1)
    expect(chips[0].key).toBe("price")
  })

  it("clearing a chip removes only that facet", () => {
    const s: ListingFacetState = {
      ...base,
      sellerHandles: ["kofi", "ama"],
      minRating: 4,
      sort: "price_asc",
    }
    const seller = appliedFacets(s).find((f) => f.key === "seller:kofi")
    const next = seller!.clear(s)
    expect(next.sellerHandles).toEqual(["ama"])
    expect(next.minRating).toBe(4)
    expect(next.sort).toBe("price_asc")
  })

  it("resolves labels through the lookup, falling back to the raw id", () => {
    const s = { ...base, sellerHandles: ["kofi"], subCategory: "cat_1" }
    const chips = appliedFacets(s, {
      sellerName: () => "Kofi Stores",
      subCategoryLabel: () => "Phones",
    })
    expect(chips.map((c) => c.label)).toEqual(["Phones", "Kofi Stores"])
    expect(appliedFacets(s)[1].label).toBe("kofi")
  })

  it("does not count the default sort as an applied facet", () => {
    expect(activeFacetCount({ ...base, sort: "featured" })).toBe(0)
    expect(activeFacetCount({ ...base, sort: "title" })).toBe(1)
  })

  it("clearing every chip in turn lands back on the empty state", () => {
    let s: ListingFacetState = {
      attributes: {},
      sellerHandles: ["kofi"],
      sort: "price_desc",
      priceMin: 5,
      priceMax: 50,
      minRating: 3,
      subCategory: "cat_1",
      location: { province: "Greater Accra", city: "Accra" },
    }
    for (const chip of appliedFacets(s)) s = chip.clear(s)
    expect(s).toEqual(resetFacets())
    expect(activeFacetCount(s)).toBe(0)
  })
})

describe("filterListingByRating", () => {
  it("treats a missing rating as 5 so new listings are not buried", () => {
    const items = [{ rating: 2 }, { rating: null }, { rating: 4 }]
    expect(filterListingByRating(items, 4)).toHaveLength(2)
  })

  it("passes everything through at rating 0", () => {
    const items = [{ rating: 1 }, { rating: 5 }]
    expect(filterListingByRating(items, 0)).toBe(items)
  })
})

describe("sortListingProducts", () => {
  it("sinks priceless items to the end when sorting ascending", () => {
    const items = [
      { title: "b", amount: null },
      { title: "a", amount: 10 },
    ]
    expect(sortListingProducts(items, "price_asc").map((i) => i.title)).toEqual([
      "a",
      "b",
    ])
  })

  it("does not mutate the input array", () => {
    const items = [{ title: "b" }, { title: "a" }]
    sortListingProducts(items, "title")
    expect(items.map((i) => i.title)).toEqual(["b", "a"])
  })
})
