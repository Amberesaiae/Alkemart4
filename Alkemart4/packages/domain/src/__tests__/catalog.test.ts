import { describe, it, expect } from "vitest"
import { asPesewas } from "../money"
import { toProductCard, toProductDetail } from "../catalog"

const product = {
  productId: "prod-phone",
  title: "Tecno Spark",
  categoryHandle: "phones",
  categoryName: "Phones",
  imageUrl: "https://cdn.example/phone.jpg",
  description: "Budget Android",
  imageUrls: ["https://cdn.example/phone.jpg"],
}

const threeOffers = [
  {
    offerId: "offer-mid",
    sellerId: "seller-b",
    sellerHandle: "kumasi-tech",
    sellerName: "Kumasi Tech",
    pricePesewas: asPesewas(3000),
    onHand: 4,
    reserved: 0,
    deliveryFeePesewas: asPesewas(800),
  },
  {
    offerId: "offer-cheap",
    sellerId: "seller-a",
    sellerHandle: "accra-mart",
    sellerName: "Accra Mart",
    pricePesewas: asPesewas(1500),
    onHand: 10,
    reserved: 1,
    deliveryFeePesewas: asPesewas(500),
  },
  {
    offerId: "offer-high",
    sellerId: "seller-c",
    sellerHandle: "tamale-gadgets",
    sellerName: "Tamale Gadgets",
    pricePesewas: asPesewas(4500),
    onHand: 2,
    reserved: 0,
    deliveryFeePesewas: asPesewas(1200),
  },
]

describe("toProductCard", () => {
  it("sets offerCount=3 and fromPricePesewas to the min sellable offer", () => {
    const card = toProductCard(product, threeOffers)
    expect(card.offerCount).toBe(3)
    expect(card.fromPricePesewas).toBe("1500")
    expect(card.bestOfferId).toBe("offer-cheap")
    expect(card).toMatchObject({
      productId: "prod-phone",
      title: "Tecno Spark",
      categoryHandle: "phones",
      categoryName: "Phones",
      imageUrl: "https://cdn.example/phone.jpg",
      currency: "ghs",
    })
  })

  it("throws when there are no sellable offers", () => {
    expect(() => toProductCard(product, [])).toThrow(/sellable/i)
  })
})

describe("toProductDetail", () => {
  it("lists sellable peer offers cheapest first", () => {
    const detail = toProductDetail(product, threeOffers)
    expect(detail.offers.map((o) => o.offerId)).toEqual([
      "offer-cheap",
      "offer-mid",
      "offer-high",
    ])
    expect(detail.offers[0]).toMatchObject({
      sellerHandle: "accra-mart",
      pricePesewas: "1500",
      available: 9,
      currency: "ghs",
    })
    expect(detail).toMatchObject({
      productId: "prod-phone",
      title: "Tecno Spark",
      description: "Budget Android",
      categoryHandle: "phones",
      categoryName: "Phones",
      imageUrls: ["https://cdn.example/phone.jpg"],
    })
  })

  it("allows an empty offers list (PDP of a product with no sellable offers)", () => {
    const detail = toProductDetail(product, [])
    expect(detail.offers).toEqual([])
  })
})
