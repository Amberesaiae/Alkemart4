import {
  assertCanPropose,
  qualityMetadataSnapshot,
  scoreProductQuality,
} from "../product-quality"

describe("scoreProductQuality", () => {
  const good = {
    title: "Golden Palm Cooking Oil 1 Litre Bottle",
    description:
      "Pure palm cooking oil pressed in Ghana. Ideal for stews, frying, and everyday kitchen use. 1L sealed bottle.",
    thumbnail: "https://cdn.example.com/oil.jpg",
    images: [{ url: "https://cdn.example.com/oil-2.jpg" }],
    category_ids: ["pcat_1"],
    price_ghs: 45,
  }

  it("scores a solid product above propose minimum", () => {
    const r = scoreProductQuality(good)
    expect(r.score).toBeGreaterThanOrEqual(40)
    expect(r.blocking).toHaveLength(0)
    expect(["fair", "good", "excellent"]).toContain(r.band)
  })

  it("blocks short title and missing images", () => {
    const r = scoreProductQuality({ title: "Oil", description: "" })
    expect(r.blocking.length).toBeGreaterThan(0)
    expect(r.score).toBeLessThan(40)
  })

  it("assertCanPropose throws on poor product", () => {
    expect(() => assertCanPropose({ title: "x" })).toThrow(/quality gate/i)
  })

  it("assertCanPropose passes good product", () => {
    expect(() => assertCanPropose(good)).not.toThrow()
  })

  it("rejects out-of-range price when provided", () => {
    const r = scoreProductQuality({ ...good, price_ghs: 0.01 })
    expect(r.blocking.some((b) => /price/i.test(b))).toBe(true)
  })

  it("qualityMetadataSnapshot stores score band and checks", () => {
    const r = scoreProductQuality(good)
    const snap = qualityMetadataSnapshot(r)
    expect(snap.score).toBe(r.score)
    expect(snap.band).toBe(r.band)
    expect(Array.isArray(snap.checks)).toBe(true)
    expect(typeof snap.computed_at).toBe("string")
  })
})
