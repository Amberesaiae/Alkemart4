import { describe, expect, it } from "vitest"
import { productOfferTab, filterOffersByTab, sortOffers } from "../offer-filter"
import type { StoreProductCard } from "../products"

function card(over: Partial<StoreProductCard> & { id: string }): StoreProductCard {
  return { title: "x", ...over }
}

describe("productOfferTab — category handles take priority", () => {
  it("maps real category handles to tabs exactly", () => {
    expect(productOfferTab(card({ id: "1", categoryHandles: ["phones-electronics"] }))).toBe("electronics")
    expect(productOfferTab(card({ id: "2", categoryHandles: ["food-groceries"] }))).toBe("food")
    expect(productOfferTab(card({ id: "3", categoryHandles: ["beverages"] }))).toBe("beverages")
    expect(productOfferTab(card({ id: "4", categoryHandles: ["health-beauty"] }))).toBe("personal")
    expect(productOfferTab(card({ id: "5", categoryHandles: ["pet-care"] }))).toBe("pet")
    expect(productOfferTab(card({ id: "6", categoryHandles: ["baby-kids"] }))).toBe("baby")
  })

  it("prefers a real handle over keyword-looking title", () => {
    const p = card({
      id: "1",
      title: "Tractor Spare Part",
      categoryHandles: ["food-groceries"],
    })
    expect(productOfferTab(p)).toBe("food")
  })

  it("does not invent a tab from title when handles are missing", () => {
    expect(productOfferTab(card({ id: "1", title: "Samsung Galax" }))).toBe("all")
    expect(productOfferTab(card({ id: "2", title: "Palm Oil 1L" }))).toBe("all")
    expect(productOfferTab(card({ id: "3", title: "Baby Onesie" }))).toBe("all")
    expect(productOfferTab(card({ id: "4", title: "Bleach" }))).toBe("all")
  })

  it("is case-insensitive on handles", () => {
    expect(productOfferTab(card({ id: "1", categoryHandles: ["PHONES-ELECTRONICS"] }))).toBe("electronics")
  })
})

describe("filterOffersByTab", () => {
  it("filters by tab bucket using real handles only", () => {
    const products = [
      card({ id: "1", categoryHandles: ["pet-care"] }),
      card({ id: "2", categoryHandles: ["food-groceries"] }),
      card({ id: "3", title: "Dog leash" }),
    ]
    expect(filterOffersByTab(products, "pet").map((p) => p.id)).toEqual(["1"])
  })

  it("returns all for the all tab", () => {
    const products = [card({ id: "1" }), card({ id: "2" })]
    expect(filterOffersByTab(products, "all")).toHaveLength(2)
  })
})

describe("sortOffers", () => {
  it("sorts ascending / descending / featured", () => {
    const products = [
      card({ id: "1", amount: 50 }),
      card({ id: "2", amount: 10 }),
      card({ id: "3", amount: 30 }),
    ]
    expect(sortOffers(products, "price_asc").map((p) => p.id)).toEqual(["2", "3", "1"])
    expect(sortOffers(products, "price_desc").map((p) => p.id)).toEqual(["1", "3", "2"])
    expect(sortOffers(products, "featured").map((p) => p.id)).toEqual(["1", "2", "3"])
  })

  it("keeps null-amount products last on ascending", () => {
    const products = [card({ id: "1", amount: null }), card({ id: "2", amount: 5 })]
    expect(sortOffers(products, "price_asc").map((p) => p.id)).toEqual(["2", "1"])
  })
})
