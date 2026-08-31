import { describe, it, expect } from "vitest"
import { asPesewas } from "../money"

describe("asPesewas", () => {
  it("accepts integer bigint", () => {
    expect(asPesewas(2500n)).toBe(2500n)
  })
  it("rejects fractional number", () => {
    expect(() => asPesewas(12.5)).toThrow(/pesewas/i)
  })
  it("rejects negative", () => {
    expect(() => asPesewas(-1)).toThrow(/pesewas/i)
  })
})
