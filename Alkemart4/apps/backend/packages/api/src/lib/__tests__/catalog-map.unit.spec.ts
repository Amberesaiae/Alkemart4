import {
  accumulateOffersToCards,
  mapPublishedProductWithOffer,
  minPriceFromOfferPrices,
  paginate,
  parseLimitOffset,
  uniqueProductIdsFromOffers,
} from "../catalog-map"

describe("mapPublishedProductWithOffer", () => {
  it("returns null without offer_id", () => {
    expect(
      mapPublishedProductWithOffer({
        id: "prod_1",
        title: "Oil",
        variants: [{ id: "v1" }],
      }),
    ).toBeNull()
  })

  it("maps product with offer and seller", () => {
    const card = mapPublishedProductWithOffer({
      id: "prod_1",
      title: "Oil",
      handle: "oil",
      variants: [{ offer_id: "offer_1" }],
      seller: { id: "sel_1", name: "Tema", handle: "tema" },
    })
    expect(card).toMatchObject({
      id: "prod_1",
      title: "Oil",
      handle: "oil",
      offer_id: "offer_1",
      seller: { id: "sel_1", name: "Tema", handle: "tema" },
    })
  })
})

describe("paginate", () => {
  it("slices by offset and limit", () => {
    expect(paginate([1, 2, 3, 4, 5], 1, 2)).toEqual([2, 3])
  })
})

describe("parseLimitOffset", () => {
  it("clamps limit and offset", () => {
    expect(parseLimitOffset("10", "2")).toEqual({ limit: 10, offset: 2 })
    expect(parseLimitOffset("999", "-1").limit).toBe(100)
    expect(parseLimitOffset(undefined, undefined).limit).toBe(24)
  })
})

describe("minPriceFromOfferPrices", () => {
  it("prefers GHS", () => {
    expect(
      minPriceFromOfferPrices([
        { amount: 10, currency_code: "usd" },
        { amount: 55, currency_code: "ghs" },
        { amount: 40, currency_code: "ghs" },
      ]),
    ).toEqual({ min_price: 40, currency_code: "ghs" })
  })
})

describe("uniqueProductIdsFromOffers", () => {
  it("preserves first-seen order", () => {
    expect(
      uniqueProductIdsFromOffers([
        { product_id: "p2" },
        { product: { id: "p1" } },
        { product_id: "p2" },
        { product_id: "p3" },
      ]),
    ).toEqual(["p2", "p1", "p3"])
  })
})

describe("accumulateOffersToCards", () => {
  it("builds one card per product with min GHS and filters closed sellers", () => {
    const cards = accumulateOffersToCards(
      [
        {
          id: "off_high",
          product_id: "prod_1",
          prices: [{ amount: 90, currency_code: "ghs" }],
          product: {
            id: "prod_1",
            title: "Palm",
            status: "published",
            categories: [{ handle: "oils", name: "Oils" }],
          },
          seller: {
            id: "sel_a",
            name: "A",
            handle: "a",
            status: "open",
          },
        },
        {
          id: "off_low",
          product_id: "prod_1",
          prices: [{ amount: 55, currency_code: "ghs" }],
          product: {
            id: "prod_1",
            title: "Palm",
            status: "published",
            categories: [{ handle: "oils", name: "Oils" }],
          },
          seller: {
            id: "sel_b",
            name: "B",
            handle: "b",
            status: "open",
          },
        },
        {
          id: "off_closed",
          product_id: "prod_2",
          prices: [{ amount: 1, currency_code: "ghs" }],
          product: { id: "prod_2", title: "X", status: "published" },
          seller: {
            id: "sel_c",
            handle: "c",
            status: "suspended",
          },
        },
      ],
      {},
    )
    expect(cards).toHaveLength(1)
    expect(cards[0].id).toBe("prod_1")
    expect(cards[0].min_price).toBe(55)
    expect(cards[0].offer_id).toBe("off_low")
    expect(cards[0].seller?.handle).toBe("b")
  })

  it("filters by seller_handle and category_handle", () => {
    const rows = [
      {
        id: "o1",
        product_id: "p1",
        prices: [{ amount: 10, currency_code: "ghs" }],
        product: {
          id: "p1",
          title: "T",
          status: "published",
          categories: [{ handle: "phones", name: "Phones" }],
        },
        seller: { id: "s1", handle: "lamp", status: "open" },
      },
      {
        id: "o2",
        product_id: "p2",
        prices: [{ amount: 20, currency_code: "ghs" }],
        product: {
          id: "p2",
          title: "U",
          status: "published",
          categories: [{ handle: "oils", name: "Oils" }],
        },
        seller: { id: "s2", handle: "amberstone", status: "open" },
      },
    ]
    expect(
      accumulateOffersToCards(rows, { sellerHandle: "amberstone" }).map(
        (c) => c.id,
      ),
    ).toEqual(["p2"])
    expect(
      accumulateOffersToCards(rows, { categoryHandle: "phones" }).map(
        (c) => c.id,
      ),
    ).toEqual(["p1"])
  })
})
