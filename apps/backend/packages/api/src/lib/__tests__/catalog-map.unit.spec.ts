import { mapPublishedProductWithOffer, paginate } from "../catalog-map"

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
    expect(card).toEqual({
      id: "prod_1",
      title: "Oil",
      handle: "oil",
      thumbnail: undefined,
      description: undefined,
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
