import { describe, it, expect } from "vitest"
import { asPesewas } from "../money"
import { isSellable } from "../sellable"

const sellable = {
  productStatus: "published" as const,
  sellerStatus: "open" as const,
  offerActive: true,
  onHand: 5,
  reserved: 1,
  pricePesewas: asPesewas(2500),
}

const matrix = [
  { name: "all clauses pass", input: sellable, expected: true },
  { name: "draft product", input: { ...sellable, productStatus: "draft" as const }, expected: false },
  { name: "proposed product", input: { ...sellable, productStatus: "proposed" as const }, expected: false },
  { name: "rejected product", input: { ...sellable, productStatus: "rejected" as const }, expected: false },
  { name: "seller not open", input: { ...sellable, sellerStatus: "suspended" as const }, expected: false },
  { name: "inactive offer", input: { ...sellable, offerActive: false }, expected: false },
  { name: "no available stock", input: { ...sellable, onHand: 2, reserved: 2 }, expected: false },
  { name: "zero price", input: { ...sellable, pricePesewas: asPesewas(0) }, expected: false },
] as const

describe("isSellable", () => {
  it.each(matrix)("$name → $expected", ({ input, expected }) => {
    expect(isSellable(input)).toBe(expected)
  })
})
