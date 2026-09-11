import { describe, expect, it } from "vitest"
import {
  buildVariantMatrix,
  comboLabel,
  InvalidVariantMatrixError,
  normalizeOptionSpecs,
} from "./variant-matrix"

function throws(fn: () => unknown): string {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(InvalidVariantMatrixError)
    return (err as Error).message
  }
  throw new Error("did not throw")
}

describe("normalizeOptionSpecs", () => {
  it("cleans names, dedupes values case-insensitively", () => {
    expect(
      normalizeOptionSpecs([{ name: "  Size ", values: ["S", "s", " M "] }]),
    ).toEqual([{ name: "Size", values: ["S", "M"] }])
  })

  it("rejects 3 types, empty values, and oversize matrices", () => {
    expect(() =>
      normalizeOptionSpecs([
        { name: "A", values: ["1"] },
        { name: "B", values: ["1"] },
        { name: "C", values: ["1"] },
      ]),
    ).toThrowError(/at most 2 option types/)
    throws(() => normalizeOptionSpecs([{ name: "Size", values: [" ", ""] }]))
    const six = ["1", "2", "3", "4", "5", "6"]
    throws(() =>
      normalizeOptionSpecs([
        { name: "A", values: six },
        { name: "B", values: six },
      ]),
    )
  })
})

describe("buildVariantMatrix", () => {
  it("expands the cartesian product in spec order", () => {
    expect(
      buildVariantMatrix([
        { name: "Size", values: ["S", "M"] },
        { name: "Colour", values: ["Red"] },
      ]),
    ).toEqual([
      { Size: "S", Colour: "Red" },
      { Size: "M", Colour: "Red" },
    ])
  })

  it("labels combos in spec order", () => {
    expect(comboLabel({ Size: "M", Colour: "Navy" }, ["Size", "Colour"])).toBe("M / Navy")
  })
})
