import { describe, expect, it } from "vitest"
import {
  EMPTY_FACETS,
  appliedFacets,
  parseAttributeFacets,
  serializeAttributeFacets,
  toggleAttributeFacet,
} from "../ListingFacets"

describe("attribute facet URL codec", () => {
  it("round-trips through the URL, order-stable", () => {
    const raw = serializeAttributeFacets({ "phone.ram_gb": ["8", "16"], brand: ["Lenovo"] })
    // Sorted so the same selection always produces the same shareable URL and
    // the same react-query cache key.
    expect(raw).toBe("brand:Lenovo;phone.ram_gb:16,8")
    expect(parseAttributeFacets(raw)).toEqual({ brand: ["Lenovo"], "phone.ram_gb": ["16", "8"] })
  })

  it("serialises nothing when no values are selected", () => {
    expect(serializeAttributeFacets({})).toBeUndefined()
    expect(serializeAttributeFacets({ brand: [] })).toBeUndefined()
  })

  it("fails closed on a hand-edited URL", () => {
    expect(parseAttributeFacets("garbage")).toEqual({})
    expect(parseAttributeFacets(":novalue")).toEqual({})
    expect(parseAttributeFacets("code:")).toEqual({})
    expect(parseAttributeFacets(undefined)).toEqual({})
    expect(parseAttributeFacets(42)).toEqual({})
  })
})

describe("toggleAttributeFacet", () => {
  it("adds, then removes, dropping the code when it empties", () => {
    let s = toggleAttributeFacet(EMPTY_FACETS, "brand", "Lenovo")
    expect(s.attributes).toEqual({ brand: ["Lenovo"] })
    s = toggleAttributeFacet(s, "brand", "HP")
    expect(s.attributes).toEqual({ brand: ["Lenovo", "HP"] })
    s = toggleAttributeFacet(s, "brand", "Lenovo")
    expect(s.attributes).toEqual({ brand: ["HP"] })
    s = toggleAttributeFacet(s, "brand", "HP")
    // Empty code removed entirely, so the URL stays clean.
    expect(s.attributes).toEqual({})
  })
})

describe("applied chips", () => {
  it("shows one removable chip per selected value, labelled by the definition", () => {
    const state = { ...EMPTY_FACETS, attributes: { "phone.ram_gb": ["8", "16"] } }
    const chips = appliedFacets(state, {
      attributeLabel: (code) => (code === "phone.ram_gb" ? "RAM" : code),
    })
    expect(chips.map((c) => [c.group, c.label])).toEqual([["RAM", "8"], ["RAM", "16"]])
    // Clearing one chip leaves the other selection intact.
    expect(chips[0].clear(state).attributes).toEqual({ "phone.ram_gb": ["16"] })
  })
})
