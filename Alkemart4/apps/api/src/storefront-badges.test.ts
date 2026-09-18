import { describe, expect, it } from "vitest"
import {
  coerceDeliveryBand,
  coversDay,
  deliveryLabel,
  isDeliveryBand,
  isNewShop,
  isTopRated,
  openState,
  opensAtLabel,
  sellerBadges,
} from "@alkemart/shared/storefront-badges"

/** Wednesday 2026-09-16, 14:30 local. */
const WED_1430 = new Date(2026, 8, 16, 14, 30)

describe("delivery bands", () => {
  it("accepts only the published bands", () => {
    expect(isDeliveryBand(20)).toBe(true)
    expect(isDeliveryBand(40)).toBe(true)
    expect(isDeliveryBand(35)).toBe(false)
    expect(isDeliveryBand("40")).toBe(false)
    expect(isDeliveryBand(null)).toBe(false)
  })

  it("rounds up to the next band, never down", () => {
    // Rounding 35 down to 30 would promise a buyer five minutes nobody agreed to.
    expect(coerceDeliveryBand(35)).toBe(40)
    expect(coerceDeliveryBand(20)).toBe(20)
    expect(coerceDeliveryBand(1)).toBe(20)
    expect(coerceDeliveryBand(500)).toBe(120)
  })

  it("has no label for a missing or nonsense band", () => {
    expect(deliveryLabel(null)).toBeNull()
    expect(deliveryLabel(0)).toBeNull()
    expect(deliveryLabel(-5)).toBeNull()
    expect(deliveryLabel(40)).toBe("40 min delivery")
  })
})

describe("isTopRated", () => {
  it("needs a high score AND enough reviews to mean it", () => {
    expect(isTopRated(4.9, 40)).toBe(true)
    expect(isTopRated(5, 1)).toBe(false) // one review is not a track record
    expect(isTopRated(4.4, 200)).toBe(false)
    expect(isTopRated(null, 200)).toBe(false)
  })
})

describe("coversDay", () => {
  it("reads the vendor form's day grammar", () => {
    expect(coversDay("Daily", 3)).toBe(true)
    expect(coversDay("Mon-Fri", 3)).toBe(true)
    expect(coversDay("Mon-Fri", 0)).toBe(false)
    expect(coversDay("Mon,Wed,Fri", 3)).toBe(true)
    expect(coversDay("Mon,Wed,Fri", 2)).toBe(false)
  })

  it("keeps wrap-around ranges contiguous", () => {
    expect(coversDay("Sat-Sun", 6)).toBe(true)
    expect(coversDay("Sat-Sun", 0)).toBe(true)
    expect(coversDay("Sat-Sun", 3)).toBe(false)
    expect(coversDay("Fri-Mon", 1)).toBe(true)
    expect(coversDay("Fri-Mon", 3)).toBe(false)
  })
})

describe("openState", () => {
  it("is unknown without usable hours, never guessed open", () => {
    expect(openState(null, WED_1430).state).toBe("unknown")
    expect(openState({ days: "Daily", open: "9am", close: "5pm" }, WED_1430).state).toBe("unknown")
  })

  it("reports how long is left in the trading day", () => {
    const s = openState({ days: "Mon-Fri", open: "08:00", close: "18:00" }, WED_1430)
    expect(s).toEqual({ state: "open", closesInMinutes: 210 })
  })

  it("is closed on a day the shop does not trade", () => {
    const s = openState({ days: "Sat-Sun", open: "08:00", close: "18:00" }, WED_1430)
    expect(s).toEqual({ state: "closed", opensAt: "08:00" })
  })

  it("keeps an overnight shop open past midnight", () => {
    const lateWed = new Date(2026, 8, 16, 23, 30)
    expect(openState({ days: "Daily", open: "22:00", close: "02:00" }, lateWed)).toEqual({
      state: "open",
      closesInMinutes: 150,
    })
    const earlyThu = new Date(2026, 8, 17, 1, 0)
    expect(openState({ days: "Daily", open: "22:00", close: "02:00" }, earlyThu)).toEqual({
      state: "open",
      closesInMinutes: 60,
    })
  })
})

describe("opensAtLabel", () => {
  it("turns a closed shop into a pre-order", () => {
    expect(opensAtLabel("07:00")).toBe("Get it from 7:00 AM")
    expect(opensAtLabel("00:30")).toBe("Get it from 12:30 AM")
    expect(opensAtLabel("12:00")).toBe("Get it from 12:00 PM")
    expect(opensAtLabel("19:45")).toBe("Get it from 7:45 PM")
    expect(opensAtLabel(null)).toBeNull()
  })
})

describe("sellerBadges", () => {
  it("says only that a paused shop is closed", () => {
    const badges = sellerBadges(
      { availability: "paused", ratingAvg: 5, ratingCount: 900, deliveryMinutes: 20 },
      WED_1430,
    )
    expect(badges.map((b) => b.id)).toEqual(["paused"])
  })

  it("earns top rated and fast delivery together", () => {
    const badges = sellerBadges(
      {
        ratingAvg: 4.8,
        ratingCount: 53,
        deliveryMinutes: 20,
        hours: { days: "Daily", open: "08:00", close: "22:00" },
      },
      WED_1430,
    )
    expect(badges.map((b) => b.id)).toEqual(["top_rated", "fast_delivery"])
  })

  it("warns when the shop is about to close", () => {
    const nearClose = new Date(2026, 8, 16, 17, 30)
    const badges = sellerBadges(
      { hours: { days: "Daily", open: "08:00", close: "18:00" } },
      nearClose,
    )
    expect(badges.map((b) => b.id)).toEqual(["closing_soon"])
  })

  it("offers a pre-order time instead of a dead card when closed", () => {
    const badges = sellerBadges(
      { hours: { days: "Daily", open: "07:00", close: "12:00" } },
      WED_1430,
    )
    expect(badges).toEqual([{ id: "opens_later", label: "Get it from 7:00 AM", tone: "warn" }])
  })

  it("does not award fast delivery to a slow band", () => {
    const badges = sellerBadges({ deliveryMinutes: 60 }, WED_1430)
    expect(badges.map((b) => b.id)).not.toContain("fast_delivery")
  })

  it("only calls a shop new when it has nothing better to show", () => {
    const joined = new Date(2026, 8, 1).toISOString()
    expect(sellerBadges({ memberSince: joined }, WED_1430).map((b) => b.id)).toEqual(["new_shop"])
    // A shop with a real badge does not also need "New" competing with it.
    expect(
      sellerBadges({ memberSince: joined, ratingAvg: 4.9, ratingCount: 30 }, WED_1430).map((b) => b.id),
    ).toEqual(["top_rated"])
  })

  it("is empty rather than inventing a claim", () => {
    expect(sellerBadges({}, WED_1430)).toEqual([])
    expect(sellerBadges({ ratingAvg: 3.2, ratingCount: 4, deliveryMinutes: 60 }, WED_1430)).toEqual([])
  })
})

describe("isNewShop", () => {
  it("ignores missing, unparseable and future dates", () => {
    expect(isNewShop(null, WED_1430)).toBe(false)
    expect(isNewShop("not a date", WED_1430)).toBe(false)
    expect(isNewShop(new Date(2026, 9, 1).toISOString(), WED_1430)).toBe(false)
  })

  it("ages out after the window", () => {
    expect(isNewShop(new Date(2026, 7, 1).toISOString(), WED_1430)).toBe(false)
  })
})
