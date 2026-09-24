import { describe, expect, it } from "vitest"
import { fingerprintOf, proposalsFor, titleSimilarity } from "./match-fingerprint"

const p = (o: Partial<Parameters<typeof fingerprintOf>[0]> & { id: string; title: string }) => ({
  productType: null, brand: null, model: null, gtin: null, ...o,
})

describe("fingerprintOf", () => {
  it("prefers GTIN when present", () => {
    expect(fingerprintOf(p({ id: "1", title: "x", gtin: "0194252 707 20", brand: "Apple" })))
      .toBe("gtin:019425270720")
  })
  it("falls back to type + brand + model — the Ghana path", () => {
    expect(fingerprintOf(p({ id: "1", title: "x", productType: "laptop", brand: "Lenovo", model: "T480" })))
      .toBe("tbm:laptop|lenovo|t480")
  })
  it("normalises punctuation and case so spellings converge", () => {
    const a = fingerprintOf(p({ id: "1", title: "x", productType: "Laptop", brand: "LENOVO", model: "T-480" }))
    const b = fingerprintOf(p({ id: "2", title: "y", productType: "laptop", brand: "lenovo", model: "T 480" }))
    expect(a).toBe(b)
  })
  it("returns null on thin identity rather than guessing", () => {
    expect(fingerprintOf(p({ id: "1", title: "Nice dress", productType: "dress" }))).toBeNull()
    expect(fingerprintOf(p({ id: "1", title: "x", brand: "Lenovo" }))).toBeNull()
  })
})

describe("titleSimilarity", () => {
  it("scores near-identical titles high and unrelated ones at zero", () => {
    expect(titleSimilarity("Lenovo ThinkPad T480 8GB", "Lenovo ThinkPad T480 8GB RAM")).toBeGreaterThan(0.7)
    expect(titleSimilarity("Lenovo ThinkPad", "Bag of rice")).toBe(0)
  })
  it("ignores very short tokens", () => {
    expect(titleSimilarity("a b c", "a b c")).toBe(0)
  })
})

describe("proposalsFor", () => {
  const subject = p({ id: "s", title: "Lenovo ThinkPad T480 8GB", productType: "laptop", brand: "Lenovo", model: "T480" })

  it("proposes an exact fingerprint match as a rule", () => {
    const twin = p({ id: "t", title: "ThinkPad T480 laptop", productType: "laptop", brand: "lenovo", model: "t-480" })
    const [first] = proposalsFor(subject, [twin])
    expect(first).toMatchObject({ candidateId: "t", source: "rules" })
  })

  it("never proposes a product against itself", () => {
    expect(proposalsFor(subject, [subject])).toEqual([])
  })

  it("only proposes similarity within the same product type", () => {
    const sameWords = p({ id: "o", title: "Lenovo ThinkPad T480 8GB", productType: "monitor" })
    expect(proposalsFor(subject, [sameWords])).toEqual([])
  })

  it("proposes similarity inside the type, with the score as evidence", () => {
    const near = p({ id: "n", title: "Lenovo ThinkPad T480 laptop 8GB", productType: "laptop" })
    const [first] = proposalsFor(subject, [near])
    expect(first.source).toBe("similarity")
    expect(first.evidence.titleSimilarity).toBeGreaterThan(0.6)
  })

  it("proposes nothing for a thin-identity product — seller_specific is honest", () => {
    const thin = p({ id: "d", title: "Beautiful ankara dress" })
    const other = p({ id: "d2", title: "Beautiful ankara dress" })
    expect(proposalsFor(thin, [other])).toEqual([])
  })

  it("ranks rule matches above similarity and caps the list", () => {
    const twin = p({ id: "t", title: "zzz", productType: "laptop", brand: "Lenovo", model: "T480" })
    const near = p({ id: "n", title: "Lenovo ThinkPad T480 laptop", productType: "laptop" })
    const out = proposalsFor(subject, [near, twin], 1)
    expect(out).toHaveLength(1)
    expect(out[0].source).toBe("rules")
  })
})
