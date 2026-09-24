import { beforeEach, describe, expect, it } from "vitest"
import {
  distanceKm, formatDistance, readPin, sortByDistance, writePin, type BuyerPin,
} from "../nearby"

const accra: BuyerPin = { lat: 5.6037, lng: -0.187, at: Date.now() }

describe("pin storage", () => {
  beforeEach(() => window.localStorage.clear())

  it("round-trips a pin", () => {
    writePin({ lat: 5.6037, lng: -0.187 })
    expect(readPin()).toMatchObject({ lat: 5.6037, lng: -0.187 })
  })

  it("refuses a pin outside Ghana — a bad read is not a location", () => {
    writePin({ lat: 50.1, lng: 8.6 })
    expect(readPin()).toBeNull()
  })

  it("expires a pin older than a week", () => {
    window.localStorage.setItem(
      "alkemart.pin",
      JSON.stringify({ lat: 5.6, lng: -0.18, at: Date.now() - 8 * 24 * 3600 * 1000 }),
    )
    expect(readPin()).toBeNull()
  })

  it("fails closed on malformed storage", () => {
    window.localStorage.setItem("alkemart.pin", "{nope")
    expect(readPin()).toBeNull()
  })

  it("clears with null", () => {
    writePin({ lat: 5.6, lng: -0.18 })
    writePin(null)
    expect(readPin()).toBeNull()
  })
})

describe("distanceKm", () => {
  it("measures real ground distance", () => {
    // Accra → Kumasi is roughly 200 km.
    const d = distanceKm(accra, { lat: 6.6885, lng: -1.6244 })
    expect(d).toBeGreaterThan(190)
    expect(d).toBeLessThan(220)
  })
  it("is null without a pin, or without shop coordinates", () => {
    expect(distanceKm(null, { lat: 6.7, lng: -1.6 })).toBeNull()
    expect(distanceKm(accra, { lat: null, lng: null })).toBeNull()
  })
})

describe("formatDistance", () => {
  it("uses metres under a kilometre — walk versus trotro", () => {
    expect(formatDistance(0.42)).toBe("420 m away")
  })
  it("uses one decimal up to 10 km, whole numbers beyond", () => {
    expect(formatDistance(3.24)).toBe("3.2 km away")
    expect(formatDistance(203.6)).toBe("204 km away")
  })
  it("renders nothing when distance is unknown", () => {
    expect(formatDistance(null)).toBeNull()
  })
})

describe("sortByDistance", () => {
  const shops = [
    { id: "kumasi", lat: 6.6885, lng: -1.6244 },
    { id: "unpinned", lat: null, lng: null },
    { id: "tema", lat: 5.6698, lng: -0.0166 },
  ]

  it("puts the nearest first", () => {
    expect(sortByDistance(shops, accra).map((s) => s.id)).toEqual(["tema", "kumasi", "unpinned"])
  })

  it("keeps unpinned shops behind, not buried as infinitely far", () => {
    // A shop without coordinates is unknown, not distant — it must not be
    // punished for the seller not having tapped a button yet.
    const out = sortByDistance(shops, accra)
    expect(out[out.length - 1].id).toBe("unpinned")
  })

  it("leaves order untouched with no pin", () => {
    expect(sortByDistance(shops, null).map((s) => s.id)).toEqual(["kumasi", "unpinned", "tema"])
  })
})
