import { describe, expect, it } from "vitest"
import {
  trackCategoryViewed,
  trackCollectionViewed,
  trackComparisonOpened,
  trackDeliveryChecked,
  trackFilterApplied,
  trackFilterRemoved,
  trackOfferSelected,
  trackPromotionSelected,
  trackPromotionViewed,
  trackSearchRefined,
  trackSearchZeroResults,
  trackVariantSelected,
} from "../analytics"

describe("blueprint Doc 10 vocabulary (additive, never throws)", () => {
  it("emits discovery events without PII requirements", () => {
    expect(() =>
      trackCategoryViewed({ categoryId: "cat_phones", slug: "phones" }),
    ).not.toThrow()
    expect(() =>
      trackCollectionViewed({ collectionId: "col_1", sellerId: "seller_a" }),
    ).not.toThrow()
    expect(() =>
      trackFilterApplied({ dimension: "brand", value: "Tecno" }),
    ).not.toThrow()
    expect(() =>
      trackFilterRemoved({ dimension: "brand", value: "Tecno" }),
    ).not.toThrow()
    expect(() => trackSearchZeroResults({ query: "asdfgh" })).not.toThrow()
    expect(() =>
      trackSearchRefined({ query: "tecno spark", fromQuery: "tecno" }),
    ).not.toThrow()
  })

  it("emits comparison events with offer identity", () => {
    expect(() =>
      trackComparisonOpened({ productId: "p1", offerCount: 3 }),
    ).not.toThrow()
    expect(() =>
      trackOfferSelected({ productId: "p1", offerId: "off_9" }),
    ).not.toThrow()
    expect(() =>
      trackVariantSelected({ productId: "p1", variantId: "v2" }),
    ).not.toThrow()
    expect(() =>
      trackDeliveryChecked({ offerId: "off_9", area: "accra", eligible: true }),
    ).not.toThrow()
  })

  it("emits promotion events with placement context", () => {
    expect(() =>
      trackPromotionViewed({ placementId: "lead", campaignId: "camp_1" }),
    ).not.toThrow()
    expect(() =>
      trackPromotionSelected({
        placementId: "lead",
        campaignId: "camp_1",
        position: 1,
      }),
    ).not.toThrow()
  })
})
