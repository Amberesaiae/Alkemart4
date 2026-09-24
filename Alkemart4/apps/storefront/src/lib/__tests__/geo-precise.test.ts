import { beforeEach, describe, expect, it, vi } from "vitest"
import { locatePrecisely } from "../geo"

const nearest = (lat: number) => (lat > 6 ? { name: "Ashanti" } : null)

function mockGeolocation(impl: Partial<Geolocation> | null) {
  Object.defineProperty(navigator, "geolocation", { value: impl, configurable: true })
}

describe("locatePrecisely", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("returns the region AND the coordinates — both halves of location", async () => {
    mockGeolocation({
      getCurrentPosition: (ok) =>
        ok({ coords: { latitude: 6.68, longitude: -1.62, accuracy: 24 } } as GeolocationPosition),
    })
    // The region seeds "Deliver to"; the coordinate becomes the pin that makes
    // "near me" a real distance. Earlier this returned region only, which is
    // why proximity could not be computed at all.
    expect(await locatePrecisely((lat) => nearest(lat))).toEqual({
      ok: true,
      region: "Ashanti",
      lat: 6.68,
      lng: -1.62,
      accuracyM: 24,
    })
  })

  it("tolerates a device that reports no accuracy", async () => {
    mockGeolocation({
      getCurrentPosition: (ok) =>
        ok({ coords: { latitude: 6.68, longitude: -1.62 } } as GeolocationPosition),
    })
    const out = await locatePrecisely((lat) => nearest(lat))
    expect(out).toMatchObject({ ok: true, accuracyM: null })
  })

  it("reports a declined permission instead of throwing", async () => {
    mockGeolocation({ getCurrentPosition: (_ok, err) => err?.({} as GeolocationPositionError) })
    expect(await locatePrecisely((lat) => nearest(lat))).toEqual({ ok: false, reason: "denied" })
  })

  it("reports outside-ghana rather than snapping to the nearest region", async () => {
    mockGeolocation({
      getCurrentPosition: (ok) =>
        ok({ coords: { latitude: 50.1, longitude: 8.6 } } as GeolocationPosition),
    })
    // Frankfurt. Guessing "Greater Accra" here would be worse than saying no.
    expect(await locatePrecisely(() => null)).toEqual({ ok: false, reason: "outside-ghana" })
  })

  it("degrades when the browser has no geolocation at all", async () => {
    mockGeolocation(null)
    expect(await locatePrecisely((lat) => nearest(lat))).toEqual({
      ok: false,
      reason: "unsupported",
    })
  })
})
