import {
  buildOfferPriceUpdates,
  normalizePriceGhs,
  type OfferRow,
  type VariantPriceEdit,
} from "../offer-pricing"

const offers: OfferRow[] = [
  {
    id: "offer_1",
    variant_id: "variant_a",
    prices: [
      { id: "price_1", amount: 5, currency_code: "ghs" },
      { id: "price_2", amount: 99, currency_code: "usd" },
    ],
  },
  { id: "offer_2", variant_id: "variant_b", prices: [] },
]

describe("normalizePriceGhs", () => {
  it("passes numbers through, coerces strings, drops empties", () => {
    expect(normalizePriceGhs(5.5)).toBe(5.5)
    expect(normalizePriceGhs("12")).toBe(12)
    expect(normalizePriceGhs("")).toBeNull()
    expect(normalizePriceGhs(null)).toBeNull()
    expect(normalizePriceGhs(undefined)).toBeNull()
    expect(normalizePriceGhs("abc")).toBeNull()
  })
})

describe("buildOfferPriceUpdates", () => {
  it("updates an existing owned price row by id (no currency mismatch)", () => {
    const edits: VariantPriceEdit[] = [{ id: "variant_a", price_ghs: 7 }]
    const { updates } = buildOfferPriceUpdates(edits, offers)
    expect(updates).toEqual([
      { id: "offer_1", prices: [{ id: "price_1", amount: 7, currency_code: "ghs" }] },
    ])
  })

  it("upserts a new price row when the offer has no ghs price yet", () => {
    const edits: VariantPriceEdit[] = [{ id: "variant_b", price_ghs: 3 }]
    const { updates } = buildOfferPriceUpdates(edits, offers)
    expect(updates).toEqual([{ id: "offer_2", prices: [{ amount: 3, currency_code: "ghs" }] }])
  })

  it("does not touch price rows of other currencies unless matching", () => {
    const edits: VariantPriceEdit[] = [{ id: "variant_a", price_ghs: 8 }]
    const onlyUsd: OfferRow[] = [
      { id: "offer_1", variant_id: "variant_a", prices: [{ id: "p", amount: 99, currency_code: "usd" }] },
    ]
    const { updates } = buildOfferPriceUpdates(edits, onlyUsd)
    expect(updates).toEqual([
      { id: "offer_1", prices: [{ amount: 8, currency_code: "ghs" }] },
    ])
  })

  it("reports variants with no owned offer as unmatched (never throws)", () => {
    const edits: VariantPriceEdit[] = [{ id: "variant_zzz", price_ghs: 10 }]
    const { updates, unmatched } = buildOfferPriceUpdates(edits, offers)
    expect(updates).toEqual([])
    expect(unmatched).toEqual(["variant_zzz"])
  })

  it("rejects below-minimum prices by id, ignoring the rest", () => {
    const edits: VariantPriceEdit[] = [
      { id: "variant_a", price_ghs: 0.2 },
      { id: "variant_b", price_ghs: 4 },
    ]
    const { updates, invalid } = buildOfferPriceUpdates(edits, offers)
    expect(invalid).toEqual(["variant_a"])
    expect(updates).toEqual([{ id: "offer_2", prices: [{ amount: 4, currency_code: "ghs" }] }])
  })

  it("skips edits with no price and keeps currency case-insensitive", () => {
    const edits: VariantPriceEdit[] = [{ id: "variant_a", price_ghs: 9 }, { id: "variant_b", price_ghs: null }]
    const { updates } = buildOfferPriceUpdates(edits, offers)
    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({ id: "offer_1", prices: [{ id: "price_1", amount: 9, currency_code: "ghs" }] })
  })
})
