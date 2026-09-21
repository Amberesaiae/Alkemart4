import { describe, it, expect } from "vitest"
import { asPesewas } from "../money"
import { pickBestOffer, sortPeerOffers, toPeerOffer } from "../offers"

const threeSellers = [
  { offerId: "offer-b", sellerId: "seller-b", pricePesewas: asPesewas(3000) },
  { offerId: "offer-a", sellerId: "seller-a", pricePesewas: asPesewas(1500) },
  { offerId: "offer-c", sellerId: "seller-c", pricePesewas: asPesewas(2000) },
]

describe("pickBestOffer", () => {
  it("picks the cheapest of 3 sellers", () => {
    const best = pickBestOffer(threeSellers)
    expect(best?.offerId).toBe("offer-a")
    expect(best?.pricePesewas).toBe(1500n)
  })

  it("tie-breaks equal prices by offerId", () => {
    const best = pickBestOffer([
      { offerId: "offer-z", pricePesewas: asPesewas(1000) },
      { offerId: "offer-a", pricePesewas: asPesewas(1000) },
    ])
    expect(best?.offerId).toBe("offer-a")
  })

  it("returns null for an empty list", () => {
    expect(pickBestOffer([])).toBeNull()
  })
})

describe("sortPeerOffers", () => {
  it("sorts cheapest first with offerId tie-break", () => {
    const sorted = sortPeerOffers(threeSellers)
    expect(sorted.map((o) => o.offerId)).toEqual(["offer-a", "offer-c", "offer-b"])
  })
})

describe("toPeerOffer", () => {
  it("maps available as onHand - reserved and prices as strings", () => {
    const dto = toPeerOffer({
      offerId: "offer-a",
      sellerId: "seller-a",
      sellerHandle: "accra-mart",
      sellerName: "Accra Mart",
      pricePesewas: asPesewas(1500),
      onHand: 8,
      reserved: 3,
      deliveryFeePesewas: asPesewas(500),
    })
    expect(dto).toEqual({
      offerId: "offer-a",
      sellerId: "seller-a",
      sellerHandle: "accra-mart",
      sellerName: "Accra Mart",
      pricePesewas: "1500",
      currency: "ghs",
      available: 5,
      deliveryFeePesewas: "500",
      options: {},
    })
  })
})
