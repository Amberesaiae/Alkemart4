import { describe, expect, it } from "vitest"
import { createApp } from "../index"
import { resetRateLimits } from "../middleware/security"
import { GeocoderUnavailable, reversePlace, searchPlaces, toPlace } from "./geocoder"

const osu = {
  lat: "5.556",
  lon: "-0.182",
  name: "Oxford Street",
  address: { road: "Oxford Street", suburb: "Osu", city: "Accra", state: "Greater Accra Region" },
}

const fakeFetch = (body: unknown, status = 200) => {
  const calls: string[] = []
  const f = (async (url: string) => {
    calls.push(url)
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { f, calls }
}

describe("geocoder", () => {
  it("turns a provider answer into street, area, town and region", () => {
    expect(toPlace(osu)).toMatchObject({
      label: "Oxford Street",
      street: "Oxford Street",
      area: "Osu",
      city: "Accra",
      regionId: "GH07",
      regionName: "Greater Accra",
      detail: "Osu, Accra, Greater Accra",
    })
  })

  it("drops results outside Ghana", () => {
    expect(toPlace({ ...osu, lat: "51.5", lon: "-0.12" })).toBeNull()
  })

  it("searches Ghana only and biases towards a nearby point", async () => {
    const { f, calls } = fakeFetch([osu, osu])
    const places = await searchPlaces({ fetch: f }, "oxford st", { lat: 5.6, lng: -0.2 })
    expect(places).toHaveLength(1) // duplicates collapsed
    expect(calls[0]).toContain("countrycodes=gh")
    expect(calls[0]).toContain("viewbox=")
  })

  it("keeps the pin where the user put it on reverse lookup", async () => {
    const { f } = fakeFetch({ ...osu, lat: "5.5", lon: "-0.1" })
    const p = await reversePlace({ fetch: f }, 5.55612, -0.18234)
    expect([p.lat, p.lng]).toEqual([5.55612, -0.18234])
    expect(p.street).toBe("Oxford Street")
  })

  it("still gives the region when nothing is mapped at the pin", async () => {
    const { f } = fakeFetch({ error: "Unable to geocode" })
    const p = await reversePlace({ fetch: f }, 6.69, -1.62)
    expect(p.label).toBe("Pinned spot")
    expect(p.regionName).toBe("Ashanti")
  })

  it("reports an outage instead of an empty answer", async () => {
    const { f } = fakeFetch({}, 502)
    await expect(searchPlaces({ fetch: f }, "osu")).rejects.toBeInstanceOf(GeocoderUnavailable)
  })

  it("sends the key to a paid host and never the contact email", async () => {
    const { f, calls } = fakeFetch([])
    await searchPlaces({ fetch: f, baseUrl: "https://eu1.locationiq.com/v1/", key: "k", email: "a@b.co" }, "osu")
    expect(calls[0]).toMatch(/^https:\/\/eu1\.locationiq\.com\/v1\/search\?/)
    expect(calls[0]).toContain("key=k")
    expect(calls[0]).not.toContain("email=")
  })
})

describe("/store/places", () => {
  it("answers short queries with nothing, without calling out", async () => {
    resetRateLimits()
    const res = await createApp().fetch(new Request("http://x/store/places/search?q=os"))
    expect(await res.json()).toEqual({ places: [] })
  })

  it("refuses a pin outside Ghana", async () => {
    resetRateLimits()
    const res = await createApp().fetch(new Request("http://x/store/places/reverse?lat=51.5&lng=-0.12"))
    expect(res.status).toBe(422)
  })
})
