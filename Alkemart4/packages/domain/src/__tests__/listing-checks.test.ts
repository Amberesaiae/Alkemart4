import { describe, expect, it } from "vitest"
import { checkListing } from "../listing-checks"

const good = {
  title: "Tecno Spark 20 Pro 256GB — Moonlight Black",
  description: "Brand new, sealed box. Comes with charger and case. One year warranty from the shop.",
  imageCount: 3,
  prices: [250000],
  categoryId: "phones",
}
const codes = (x: Parameters<typeof checkListing>[0]) => checkListing(x).map((f) => f.code)

describe("listing checks", () => {
  it("a good listing has no findings", () => {
    expect(checkListing(good)).toEqual([])
  })
  it("blocks contact details in title or description", () => {
    expect(codes({ ...good, title: "iPhone 13 call 0241234567" })).toContain("contact_details")
    expect(codes({ ...good, description: "DM on instagram @phonesgh" })).toContain("contact_details")
    expect(codes({ ...good, description: "order via wa.me/233241234567" })).toContain("contact_details")
  })
  it("blocks missing photo, price, category and required specs", () => {
    const c = codes({ ...good, imageCount: 0, prices: [0], categoryId: null, missingRequiredSpecs: ["RAM"] })
    expect(c).toEqual(expect.arrayContaining(["no_photo", "no_price", "no_category", "missing_specs"]))
  })
  it("flags shouting, noise and suspicious price spreads", () => {
    expect(codes({ ...good, title: "BRAND NEW PHONE FOR SALE" })).toContain("title_caps")
    expect(codes({ ...good, title: "Phone for sale!!!!!" })).toContain("title_noise")
    expect(codes({ ...good, prices: [1000, 50000] })).toContain("price_spread")
  })
})
