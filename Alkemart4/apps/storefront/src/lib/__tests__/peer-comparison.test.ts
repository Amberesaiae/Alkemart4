import { describe, expect, it } from "vitest"
import { mapWorkersPeersResponse } from "../products"

/**
 * Workers peers payload mapping (Phase 3B/3C): variant-safe rows with
 * honest totals and provenance-gated discounts. Unknown terms stay null —
 * the UI renders nothing rather than inventing badges.
 */
describe("mapWorkersPeersResponse", () => {
  it("maps offers with totals, terms, and explanation", () => {
    const mapped = mapWorkersPeersResponse(
      {
        productId: "p1",
        identityConfidence: "matched",
        comparisonEligible: true,
        sort: "total",
        explanation: "Sorted by total payable cost: item price plus delivery fee.",
        divergenceNeedsReview: false,
        priceHistory: {
          o1: [
            {
              id: "h1",
              offerId: "o1",
              oldPricePesewas: "11000",
              newPricePesewas: "10000",
              changedBy: "s1",
              createdAt: "2026-09-01T10:00:00.000Z",
            },
          ],
        },
        offers: [
          {
            offerId: "o1",
            sellerId: "s1",
            sellerHandle: "shop-one",
            sellerName: "Shop One",
            pricePesewas: "10000",
            currency: "ghs",
            available: 5,
            deliveryFeePesewas: "500",
            options: {},
            condition: "new",
            fulfillmentOrigin: "Accra warehouse",
            warrantyRef: null,
            returnsRef: "7-day returns",
            deliveryPromise: "2–3 days",
            compareAtPesewas: "12000",
            discountPercent: 17,
          },
        ],
      },
      "p1",
    )
    expect(mapped?.comparisonEligible).toBe(true)
    expect(mapped?.explanation).toMatch(/total payable cost/)
    expect(mapped?.offers).toHaveLength(1)
    expect(mapped?.offers[0]).toMatchObject({
      offerId: "o1",
      amount: 100,
      deliveryAmount: 5,
      totalAmount: 105,
      condition: "new",
      compareAtAmount: 120,
      discountPercent: 17,
      deliveryPromise: "2–3 days",
    })
    expect(mapped?.priceHistory.o1).toHaveLength(1)
    expect(mapped?.priceHistory.o1?.[0]).toMatchObject({
      oldAmount: 110,
      newAmount: 100,
    })
  })

  it("skips rows without identity and nulls unknown terms", () => {
    const mapped = mapWorkersPeersResponse(
      {
        offers: [
          { offerId: null, sellerName: "Ghost" },
          { offerId: "o2", sellerName: "  " },
          {
            offerId: "o3",
            sellerId: "s3",
            sellerHandle: "shop-three",
            sellerName: "Shop Three",
            pricePesewas: "9000",
          },
        ],
      },
      "p1",
    )
    expect(mapped?.offers.map((o) => o.offerId)).toEqual(["o3"])
    expect(mapped?.offers[0]).toMatchObject({
      deliveryAmount: null,
      totalAmount: 90,
      condition: null,
      compareAtAmount: null,
      discountPercent: null,
    })
  })

  it("marks Level C payloads ineligible and defaults the sort", () => {
    const mapped = mapWorkersPeersResponse(
      { comparisonEligible: false, offers: [], sort: "newest" },
      "p1",
    )
    expect(mapped?.comparisonEligible).toBe(false)
    expect(mapped?.offers).toEqual([])
    expect(mapped?.sort).toBe("total")
    expect(mapWorkersPeersResponse(null, "p1")).toBeNull()
    expect(mapWorkersPeersResponse("nope", "p1")).toBeNull()
  })
})
