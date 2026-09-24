import { describe, expect, it } from "vitest"
import { EMPTY_FACETS, retargetFacets, type ListingFacetState } from "../ListingFacets"

const inPhones: ListingFacetState = {
  ...EMPTY_FACETS,
  sellerHandles: ["kumasi-tech"],
  priceMin: 500,
  priceMax: 2000,
  minRating: 4,
  sort: "price_asc",
  subCategory: "phones",
  location: { province: "Ashanti", city: "Kumasi" },
  attributes: { brand: ["Lenovo"], ram_gb: ["8"] },
}

describe("retargetFacets — universal facets always survive", () => {
  it("keeps price, rating, sellers, location and sort across any move", () => {
    const { state } = retargetFacets(inPhones, ["brand"])
    expect(state.priceMin).toBe(500)
    expect(state.priceMax).toBe(2000)
    expect(state.minRating).toBe(4)
    expect(state.sellerHandles).toEqual(["kumasi-tech"])
    expect(state.location).toEqual({ province: "Ashanti", city: "Kumasi" })
    expect(state.sort).toBe("price_asc")
  })
})

describe("retargetFacets — profile-scoped facets are validated", () => {
  it("keeps codes the destination declares and drops the rest, reporting them", () => {
    // Accessories has brand but no RAM.
    const { state, dropped } = retargetFacets(inPhones, ["brand", "colour"])
    expect(state.attributes).toEqual({ brand: ["Lenovo"] })
    expect(dropped).toEqual([{ code: "ram_gb", values: ["8"] }])
  })

  it("matches codes case-insensitively", () => {
    const { state, dropped } = retargetFacets(inPhones, ["BRAND", "RAM_GB"])
    expect(state.attributes).toEqual({ brand: ["Lenovo"], ram_gb: ["8"] })
    expect(dropped).toEqual([])
  })

  it("drops everything when the destination declares no attributes", () => {
    const { state, dropped } = retargetFacets(inPhones, [])
    expect(state.attributes).toEqual({})
    expect(dropped.map((d) => d.code).sort()).toEqual(["brand", "ram_gb"])
  })

  it("drops nothing while the destination facet list is still loading", () => {
    // Guessing would remove a filter the category may well support.
    const { state, dropped } = retargetFacets(inPhones, null)
    expect(state.attributes).toEqual({ brand: ["Lenovo"], ram_gb: ["8"] })
    expect(dropped).toEqual([])
  })
})

describe("retargetFacets — sub-category", () => {
  it("keeps the sub-category when moving within a department", () => {
    expect(retargetFacets(inPhones, ["brand"]).state.subCategory).toBe("phones")
  })

  it("clears it when the department changes", () => {
    const { state } = retargetFacets(inPhones, ["brand"], { clearSubCategory: true })
    expect(state.subCategory).toBe("all")
    // …without taking the universal facets with it — the old sidebar bug.
    expect(state.priceMin).toBe(500)
  })
})

describe("retargetFacets — purity", () => {
  it("does not mutate the input state", () => {
    const before = JSON.stringify(inPhones)
    retargetFacets(inPhones, [])
    expect(JSON.stringify(inPhones)).toBe(before)
  })
})
