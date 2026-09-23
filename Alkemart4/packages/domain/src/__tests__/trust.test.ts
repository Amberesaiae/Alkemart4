import { describe, expect, it } from "vitest"
import {
  PriceIntegrityError,
  assertCompareAt,
  discountPercent,
  explainRanking,
  isOfferStale,
  priceDivergenceNeedsReview,
  rankPeerOffers,
} from "../offers"
import { isVerificationLive, verificationMeaning } from "../trust"

describe("price integrity (Phase 3A)", () => {
  it("requires provenance for compare-at prices", () => {
    expect(() => assertCompareAt(1500n, 2000n, "launch price")).not.toThrow()
    expect(() => assertCompareAt(1500n, null, null)).not.toThrow()
    expect(() => assertCompareAt(1500n, 2000n, null)).toThrow(PriceIntegrityError)
    expect(() => assertCompareAt(1500n, 1200n, "sale")).toThrow(PriceIntegrityError)
  })

  it("computes discount only with provenance", () => {
    expect(discountPercent(1500n, 2000n, "launch")).toBe(25)
    expect(discountPercent(1500n, 2000n, null)).toBeNull()
    expect(discountPercent(1500n, 1500n, "launch")).toBeNull()
  })

  it("flags excessive divergence for review, not accusation", () => {
    expect(priceDivergenceNeedsReview([1000n, 1500n])).toBe(false)
    expect(priceDivergenceNeedsReview([1000n, 4000n])).toBe(true)
    expect(priceDivergenceNeedsReview([1000n])).toBe(false)
  })

  it("suppresses stale offers after 72h", () => {
    const now = new Date("2026-09-21T12:00:00Z")
    expect(isOfferStale(null, now)).toBe(false)
    expect(isOfferStale(new Date("2026-09-21T11:00:00Z"), now)).toBe(false)
    expect(isOfferStale(new Date("2026-09-18T11:00:00Z"), now)).toBe(true)
  })
})

describe("offer ranking (Phase 3C)", () => {
  const offers = [
    { offerId: "a", pricePesewas: 2000n, deliveryFeePesewas: 0n, sellerRatingAvg: 4.8, sellerRatingCount: 50, sellerCompletedOrders: 400 },
    { offerId: "b", pricePesewas: 1500n, deliveryFeePesewas: 800n, sellerRatingAvg: 4.0, sellerRatingCount: 5, sellerCompletedOrders: 10 },
  ]
  it("defaults to total payable cost", () => {
    // a: 2000 total; b: 2300 total → a first despite higher item price.
    expect(rankPeerOffers(offers).map((o) => o.offerId)).toEqual(["a", "b"])
  })
  it("sorts by price, delivery, or trust on request", () => {
    expect(rankPeerOffers(offers, "price").map((o) => o.offerId)).toEqual(["b", "a"])
    expect(rankPeerOffers(offers, "delivery").map((o) => o.offerId)).toEqual(["a", "b"])
    expect(rankPeerOffers(offers, "trust").map((o) => o.offerId)).toEqual(["a", "b"])
  })
  it("explains every ordering without claiming best", () => {
    expect(explainRanking("price")).toMatch(/price/i)
    expect(explainRanking("delivery")).toMatch(/delivery/i)
    expect(explainRanking("trust")).toMatch(/track record/i)
    expect(explainRanking(undefined)).toMatch(/total payable/i)
  })
})

describe("verification meanings (Phase 3D)", () => {
  it("names exactly what was checked", () => {
    expect(verificationMeaning("brand_auth")).toMatch(/Authorized seller/)
    expect(verificationMeaning("contact")).toMatch(/phone and email/)
  })
  it("expires and revocation end liveness", () => {
    const now = new Date("2026-09-21T12:00:00Z")
    expect(isVerificationLive("verified", null, now)).toBe(true)
    expect(isVerificationLive("verified", new Date("2026-09-20T00:00:00Z"), now)).toBe(false)
    expect(isVerificationLive("revoked", null, now)).toBe(false)
    expect(isVerificationLive("pending", null, now)).toBe(false)
  })
})
