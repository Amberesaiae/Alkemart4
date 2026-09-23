import { describe, expect, it } from "vitest"
import { mapCourseResponse, orderShelvesForBucket } from "../course"

const CARD = {
  productId: "p1",
  title: "Tecno Spark",
  imageUrl: "https://cdn.test/p1.jpg",
  fromPricePesewas: "159900",
  currency: "ghs",
  bestOfferId: "o1",
  offerCount: 2,
  sellerId: "s1",
  sellerHandle: "shop-one",
  sellerName: "Shop One",
  availableQty: 5,
  createdAt: "2026-09-01T00:00:00.000Z",
  categoryHandle: "phones",
  categoryName: "Phones",
}

/**
 * Course payload mapping (Phase 5C): placements with winning campaigns and
 * rule shelves. Malformed rows drop out; empty slots collapse upstream.
 */
describe("mapCourseResponse", () => {
  it("maps placements, sponsored flags, creatives, and shelves", () => {
    const mapped = mapCourseResponse({
      placements: [
        {
          code: "hero",
          job: "Homepage hero",
          campaigns: [
            {
              id: "c1",
              name: "Harmattan Sale",
              trackingId: "harmattan-sale-abc123",
              objective: "sale",
              sponsored: true,
              terms: { label: "Up to 20% off", summary: "Selected phones." },
              creative: {
                desktop: { title: "Harmattan Sale", subtitle: "Phones", imageUrl: "https://cdn.test/h.jpg", link: "/search?q=phones" },
                mobile: null,
              },
              products: [CARD, { productId: "", title: "" }],
            },
          ],
        },
        { code: "deal_rail", job: "Deal rail", campaigns: [] },
        null,
      ],
      shelves: [
        { key: "most_ordered", title: "Most ordered", cards: [CARD] },
        { key: "empty", title: "Empty", cards: [] },
      ],
      generatedAt: "2026-09-21T12:00:00.000Z",
    })
    expect(mapped?.placements.map((p) => p.code)).toEqual(["hero"])
    const hero = mapped?.placements[0]!.campaigns[0]!
    expect(hero.sponsored).toBe(true)
    expect(hero.trackingId).toBe("harmattan-sale-abc123")
    expect(hero.creative.desktop?.title).toBe("Harmattan Sale")
    expect(hero.products).toHaveLength(1)
    expect(hero.products[0]).toMatchObject({ id: "p1", amount: 1599 })
    expect(mapped?.shelves.map((s) => s.key)).toEqual(["most_ordered"])
  })

  it("returns empty course for empty payloads and null for garbage", () => {
    expect(mapCourseResponse({ placements: [], shelves: [] })).toEqual({
      placements: [],
      shelves: [],
    })
    expect(mapCourseResponse(null)).toBeNull()
    expect(mapCourseResponse("nope")).toBeNull()
    expect(
      mapCourseResponse({ placements: [{ code: "", campaigns: [] }] }),
    ).toEqual({ placements: [], shelves: [] })
  })
})

describe("orderShelvesForBucket (Phase 7D)", () => {
  const shelves = [
    { key: "most_ordered", title: "Most ordered", cards: [] },
    { key: "trending", title: "Trending now", cards: [] },
    { key: "top_rated", title: "Top rated", cards: [] },
  ]
  it("keeps server order for control", () => {
    expect(orderShelvesForBucket(shelves, "control").map((s) => s.key)).toEqual([
      "most_ordered",
      "trending",
      "top_rated",
    ])
  })
  it("moves trending first for exposed units", () => {
    expect(orderShelvesForBucket(shelves, "exposed").map((s) => s.key)).toEqual([
      "trending",
      "most_ordered",
      "top_rated",
    ])
  })
  it("leaves order alone when trending leads or is missing", () => {
    expect(
      orderShelvesForBucket(
        [{ key: "trending", title: "T", cards: [] }],
        "exposed",
      ).map((s) => s.key),
    ).toEqual(["trending"])
    expect(
      orderShelvesForBucket([{ key: "new", title: "N", cards: [] }], "exposed").map(
        (s) => s.key,
      ),
    ).toEqual(["new"])
  })
})
