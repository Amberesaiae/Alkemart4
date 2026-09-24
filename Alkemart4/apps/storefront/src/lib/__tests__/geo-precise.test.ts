import { beforeEach, describe, expect, it, vi } from "vitest"
import { locatePrecisely } from "../geo"

const nearest = (lat: number) => (lat > 6 ? { name: "Ashanti" } : null)

function mockGeolocation(impl: Partial<Geolocation> | null) {
  Object.defineProperty(navigator, "geolocation", { value: impl, configurable: true })
}

describe("locatePrecisely", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("resolves coordinates to a region name and nothing else", async () => {
    mockGeolocation({
      getCurrentPosition: (ok) =>
        ok({ coords: { latitude: 6.68, longitude: -1.62 } } as GeolocationPosition),
    })
    const out = await locatePrecisely((lat) => nearest(lat))
    expect(out).toEqual({ ok: true, region: "Ashanti" })
    // The contract is that no coordinate escapes this function.
    expect(JSON.stringify(out)).not.toMatch(/6\.68|-1\.62|latitude|longitude/)
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
