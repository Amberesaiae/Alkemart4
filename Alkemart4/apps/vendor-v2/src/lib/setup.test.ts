import { describe, expect, it } from "vitest"
import { setupProgress } from "./setup"
import type { ShopSettings } from "./shop"

const bare = {
  logo: null,
  storefront: { tagline: null },
  address: null,
  delivery: { minutes: null, days: null, dispatchHours: null },
  payment_details: null,
} as unknown as ShopSettings

describe("setupProgress", () => {
  it("opens a new shop at the first step", () => {
    const p = setupProgress(bare, false)
    expect(p).toMatchObject({ count: 0, total: 5, firstOpen: "look", complete: false })
  })

  it("counts a region as the location step, by name or id", () => {
    expect(setupProgress({ ...bare, address: { province: "Greater Accra" } } as ShopSettings, false).done.location).toBe(true)
    expect(setupProgress({ ...bare, address: { province: "GH07" } } as ShopSettings, false).done.location).toBe(true)
    expect(setupProgress({ ...bare, address: { province: "Atlantis" } } as ShopSettings, false).done.location).toBe(false)
  })

  it("resumes at the first unfinished step, skipping finished ones", () => {
    const s = { ...bare, logo: "x", storefront: { tagline: "t" }, address: { province: "Ashanti" } } as ShopSettings
    expect(setupProgress(s, false).firstOpen).toBe("delivery")
  })

  it("is complete when every step is done", () => {
    const s = {
      logo: "x",
      storefront: { tagline: "t" },
      address: { province: "Ashanti" },
      delivery: { days: { min: 1, max: 2 } },
      payment_details: { type: "momo", provider: "mtn", phone: "0244000000" },
    } as unknown as ShopSettings
    expect(setupProgress(s, true)).toMatchObject({ count: 5, firstOpen: null, complete: true })
  })
})
