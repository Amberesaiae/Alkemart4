import { describe, expect, it } from "vitest"
import { itemListJsonLd, productJsonLd, storeJsonLd } from "../seo"

/**
 * Structured-data honesty (Phase 6A): the seller is never the brand,
 * ratings need verified reviews, variants stay a group, and listings
 * name only what they render.
 */
describe("productJsonLd", () => {
  it("never puts the seller in brand — even when brand is unknown", () => {
    const withoutBrand = productJsonLd({
      id: "p1",
      title: "Tecno Spark",
      path: "/product/p1",
      amount: 1599,
      currencyCode: "ghs",
      sellerName: "Accra Mart",
    })
    expect(withoutBrand).not.toHaveProperty("brand")
    const offer = withoutBrand.offers as Record<string, unknown>
    expect(offer["@type"]).toBe("Offer")
    expect(offer.seller).toEqual({ "@type": "Organization", name: "Accra Mart" })

    const withBrand = productJsonLd({
      id: "p1",
      title: "Tecno Spark",
      path: "/product/p1",
      brandName: "Tecno",
      amount: 1599,
      currencyCode: "ghs",
      sellerName: "Accra Mart",
    })
    expect(withBrand.brand).toEqual({ "@type": "Brand", name: "Tecno" })
  })

  it("collapses multiple offers into an AggregateOffer with seller nodes", () => {
    const body = productJsonLd({
      id: "p1",
      title: "Tecno Spark",
      path: "/product/p1",
      brandName: "Tecno",
      offers: [
        { price: 1599, currencyCode: "ghs", sellerName: "Accra Mart", inStock: true, deliveryFee: 5 },
        { price: 1699, currencyCode: "ghs", sellerName: "Kumasi Tech", inStock: true },
      ],
    })
    const offers = body.offers as Record<string, unknown>
    expect(offers["@type"]).toBe("AggregateOffer")
    expect(offers).toMatchObject({ lowPrice: 1599, highPrice: 1699, offerCount: 2 })
    const nodes = offers.offers as Record<string, unknown>[]
    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({
      seller: { "@type": "Organization", name: "Accra Mart" },
    })
    expect(nodes[0]).toHaveProperty("shippingDetails")
    expect(nodes[1]).not.toHaveProperty("shippingDetails")
  })

  it("gates aggregateRating on verified reviews and groups variants", () => {
    const unrated = productJsonLd({ id: "p1", title: "X", path: "/product/p1" })
    expect(unrated).not.toHaveProperty("aggregateRating")

    const rated = productJsonLd({
      id: "p1",
      title: "X",
      path: "/product/p1",
      rating: { avg: 4.5, count: 4 },
      variants: [{ name: "Size: S" }, { name: "Size: M" }],
    })
    expect(rated["@type"]).toBe("ProductGroup")
    expect(rated.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      reviewCount: 4,
    })
    expect(rated.hasVariant).toHaveLength(2)
  })
})

describe("storeJsonLd", () => {
  it("adds areaServed only when the region is known", () => {
    expect(storeJsonLd({ name: "S", path: "/shops/s" })).not.toHaveProperty("areaServed")
    expect(
      storeJsonLd({ name: "S", path: "/shops/s", location: "Greater Accra" }),
    ).toMatchObject({ areaServed: "Greater Accra" })
  })
})

describe("itemListJsonLd", () => {
  it("names rendered items with absolute urls, capped at 50", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      name: `Item ${i}`,
      path: `/product/p${i}`,
    }))
    const body = itemListJsonLd({ name: "Phones", path: "/categories/phones", items })
    expect(body["@type"]).toBe("CollectionPage")
    const list = (body.mainEntity as Record<string, unknown>).itemListElement as unknown[]
    expect(list).toHaveLength(50)
    expect(body).not.toHaveProperty("aggregateRating")
  })
})
