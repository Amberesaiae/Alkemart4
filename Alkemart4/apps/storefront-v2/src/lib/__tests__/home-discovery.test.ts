import { describe, expect, it } from "vitest"
import { rotationPick } from "@alkemart/shared/homepage"
import { createClaims, departmentOf, departmentRows, priceRow } from "@/components/home/discovery"
import type { StoreCategory, StoreProductCard } from "@/lib/products"

const cats: StoreCategory[] = [
  { id: "home-living", handle: "home-living", name: "Home & Living", rank: 2 },
  { id: "furniture", handle: "furniture", name: "Furniture", parentCategoryId: "home-living" },
  { id: "fashion-apparel", handle: "fashion-apparel", name: "Fashion & Apparel", rank: 1 },
  { id: "bags", handle: "bags", name: "Bags", parentCategoryId: "fashion-apparel" },
]
const card = (id: string, category: string, amount: number): StoreProductCard =>
  ({ id, title: id, amount, categoryHandles: [category] }) as StoreProductCard

describe("rotationPick", () => {
  const day = (n: number) => new Date(2026, 8, n, 12)

  it("is stable within a day and advances the next day", () => {
    const items = ["a", "b", "c", "d", "e"]
    expect(rotationPick(items, 2, day(10))).toEqual(rotationPick(items, 2, new Date(2026, 8, 10, 20)))
    expect(rotationPick(items, 2, day(10))).not.toEqual(rotationPick(items, 2, day(11)))
  })

  it("gives every item a turn over enough periods", () => {
    const items = ["a", "b", "c"]
    const seen = new Set(Array.from({ length: 3 }, (_, i) => rotationPick(items, 1, day(1 + i))).flat())
    expect(seen).toEqual(new Set(items))
  })

  it("holds a weekly pick for seven days", () => {
    const items = ["a", "b", "c", "d"]
    const week = Array.from({ length: 7 }, (_, i) => rotationPick(items, 1, new Date(Date.UTC(2026, 8, 7 + i, 12)), 7)[0])
    expect(new Set(week).size).toBeLessThanOrEqual(2) // one boundary at most in any 7-day span
  })

  it("never repeats within one pick and handles tiny lists", () => {
    expect(rotationPick(["a", "b"], 5, day(3)).sort()).toEqual(["a", "b"])
    expect(rotationPick([], 2, day(3))).toEqual([])
  })
})

describe("departments and price rows", () => {
  const products = [
    card("sofa", "furniture", 8500), card("rug", "furniture", 900), card("lamp", "furniture", 550), card("rack", "furniture", 750),
    card("satchel", "bags", 650), card("crossbody", "bags", 350),
  ]

  it("maps a listing to its top-level department", () => {
    expect(departmentOf(products[0]!, cats)?.handle).toBe("home-living")
    expect(departmentOf(card("x", "unknown", 1), cats)).toBeUndefined()
  })

  it("only offers departments with a full row", () => {
    expect(departmentRows(products, cats).map((r) => r.department.handle)).toEqual(["home-living"])
  })

  it("filters by price and department, cheapest first", () => {
    expect(priceRow(products, cats, 1000).map((p) => p.id)).toEqual(["crossbody", "lamp", "satchel", "rack", "rug"])
    expect(priceRow(products, cats, 1000, "home-living").map((p) => p.id)).toEqual(["lamp", "rack", "rug"])
  })
})

describe("no product twice on the homepage", () => {
  const list = (...ids: string[]) => ids.map((id) => card(id, "furniture", 1))

  it("skips products shown higher up the page", () => {
    const claims = createClaims(["a"])
    expect(claims.take(list("a", "b", "c", "d", "e")).map((p) => p.id)).toEqual(["b", "c", "d", "e"])
    expect(claims.take(list("b", "f", "g", "h", "i")).map((p) => p.id)).toEqual(["f", "g", "h", "i"])
  })

  it("hides a row that falls below four rather than padding it", () => {
    const claims = createClaims(["a", "b"])
    expect(claims.take(list("a", "b", "c", "d", "e"))).toEqual([])
    // A hidden row claims nothing, so a later row can still use those products.
    expect(claims.take(list("c", "d", "e", "f")).map((p) => p.id)).toEqual(["c", "d", "e", "f"])
  })

  it("lets a shop card show fewer, with its own minimum", () => {
    const claims = createClaims(["a", "b"])
    expect(claims.take(list("a", "b", "c"), 3, 1).map((p) => p.id)).toEqual(["c"])
  })
})
