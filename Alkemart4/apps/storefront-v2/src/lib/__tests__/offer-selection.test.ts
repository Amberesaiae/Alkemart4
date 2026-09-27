import { describe, expect, it } from "vitest"
import {
  cheapestBuyableSelection,
  resolveOfferSelection,
  type OfferSelectionInput,
} from "../offer-selection"
import type { PeerOffer } from "../products"

const peer = (offerId: string, amount: number, seller = offerId): PeerOffer => ({
  offerId,
  amount,
  currencyCode: "ghs",
  seller: { id: seller, name: `Shop ${seller}`, handle: seller },
})

const simple = (over: Partial<OfferSelectionInput> = {}): OfferSelectionInput => ({
  product: { offerId: "a", offerCount: 1, optionTypes: [], combos: [], amount: 10, currencyCode: "ghs", seller: null },
  peers: [peer("a", 10)],
  peersReady: true,
  comboSel: {},
  selectedOfferId: null,
  ...over,
})

describe("offer selection — sellers", () => {
  it("selects the only offer implicitly", () => {
    const r = resolveOfferSelection(simple())
    expect(r.activeOfferId).toBe("a")
    expect(r.canBuy).toBe(true)
  })

  it("never auto-picks when the product says two sellers, even while peers load", () => {
    const r = resolveOfferSelection(
      simple({ product: { ...simple().product, offerCount: 2 }, peers: [], peersReady: false }),
    )
    expect(r.activeOfferId).toBeNull()
    expect(r.canBuy).toBe(false)
  })

  it("with several sellers, preselects the lowest total (price + delivery) and says so", () => {
    const withFee = (o: PeerOffer, fee: number): PeerOffer => ({ ...o, deliveryAmount: fee })
    const r = resolveOfferSelection(
      simple({ product: { ...simple().product, offerCount: null }, peers: [withFee(peer("a", 10), 1), withFee(peer("b", 9), 5)] }),
    )
    expect(r.requiresOfferPick).toBe(true)
    // b is cheaper on price but a is cheaper in total (11 vs 14).
    expect(r.activeOfferId).toBe("a")
    expect(r.bestOfferId).toBe("a")
    expect(r.autoPicked).toBe(true)
    expect(r.canBuy).toBe(true)
    expect(r.blockedReason).toBeNull()
  })

  it("sells the listing's own offer when comparison is declined, even if the card counts two", () => {
    const r = resolveOfferSelection(
      simple({ product: { ...simple().product, offerCount: 2, offerId: "a" }, peers: [peer("a", 10)], peersReady: true }),
    )
    expect(r.activeOfferId).toBe("a")
    expect(r.canBuy).toBe(true)
  })

  it("binds the chosen seller and shows that seller's price", () => {
    const r = resolveOfferSelection(
      simple({
        product: { ...simple().product, offerCount: 2 },
        peers: [peer("a", 10), peer("b", 9)],
        selectedOfferId: "b",
      }),
    )
    expect(r.activeOfferId).toBe("b")
    expect(r.displayAmount).toBe(9)
    expect(r.canBuy).toBe(true)
  })

  it("ignores a stale pick that is no longer a candidate", () => {
    const r = resolveOfferSelection(
      simple({ product: { ...simple().product, offerCount: 2 }, peers: [peer("a", 10), peer("b", 9)], selectedOfferId: "gone" }),
    )
    expect(r.activeOfferId).toBe("b") // falls back to the best offer, never a dead end
    expect(r.autoPicked).toBe(true)
  })

  it("reports out of stock when no seller has it", () => {
    const r = resolveOfferSelection(
      simple({ product: { ...simple().product, offerId: null, offerCount: 0 }, peers: [] }),
    )
    expect(r.outOfStock).toBe(true)
    expect(r.blockedReason).toBe("Out of stock")
  })
})

describe("offer selection — variant matrix", () => {
  const matrix = (): OfferSelectionInput["product"] => ({
    offerId: "s-black",
    offerCount: 3,
    amount: 100,
    currencyCode: "ghs",
    seller: null,
    optionTypes: [
      { name: "Size", values: [{ value: "S", imageUrl: null }, { value: "M", imageUrl: null }] },
      { name: "Colour", values: [{ value: "Black", imageUrl: null }, { value: "Red", imageUrl: null }] },
    ],
    combos: [
      { offerId: "s-black", sellerId: "x", options: { Size: "S", Colour: "Black" }, amount: 100, availableQty: 3, active: true },
      { offerId: "m-black", sellerId: "x", options: { Size: "M", Colour: "Black" }, amount: 90, availableQty: 2, active: true },
      { offerId: "m-red", sellerId: "x", options: { Size: "M", Colour: "Red" }, amount: 80, availableQty: 0, active: true },
    ],
  })
  const peers = [peer("s-black", 100, "x"), peer("m-black", 90, "x"), peer("m-red", 80, "x")]

  it("blocks until every option is chosen, naming the missing one", () => {
    const r = resolveOfferSelection({ product: matrix(), peers, peersReady: true, comboSel: { Size: "M" }, selectedOfferId: null })
    expect(r.canBuy).toBe(false)
    expect(r.blockedReason).toBe("Choose colour")
  })

  it("resolves a complete, stocked combo to its offer", () => {
    const r = resolveOfferSelection({ product: matrix(), peers, peersReady: true, comboSel: { Size: "M", Colour: "Black" }, selectedOfferId: null })
    expect(r.activeOfferId).toBe("m-black")
    expect(r.displayAmount).toBe(90)
    expect(r.canBuy).toBe(true)
  })

  it("marks an unstocked combo out of stock and its chip unbuyable", () => {
    const r = resolveOfferSelection({ product: matrix(), peers, peersReady: true, comboSel: { Size: "M", Colour: "Red" }, selectedOfferId: null })
    expect(r.outOfStock).toBe(true)
    expect(r.blockedReason).toBe("This combination is out of stock")
    const colour = r.options.find((o) => o.name === "Colour")!
    expect(colour.values.find((v) => v.value === "Red")).toMatchObject({ exists: true, buyable: false })
  })

  it("hides values that no combination offers", () => {
    const r = resolveOfferSelection({ product: matrix(), peers, peersReady: true, comboSel: { Size: "S" }, selectedOfferId: null })
    const red = r.options.find((o) => o.name === "Colour")!.values.find((v) => v.value === "Red")!
    expect(red.exists).toBe(false)
  })

  it("preselects the cheapest buyable combo (never an unstocked one)", () => {
    expect(cheapestBuyableSelection(matrix(), peers)).toEqual({ Size: "M", Colour: "Black" })
  })
})
