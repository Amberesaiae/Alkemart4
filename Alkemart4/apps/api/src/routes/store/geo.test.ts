import { describe, expect, it, beforeEach } from "vitest"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"

type GeoBody = {
  country: string | null
  region: string | null
  regionId: string | null
  city: string | null
}

// No repo needed: /store/geo is mounted with noStoreHeaders alone and answers
// purely from request.cf, so it never binds a database.
const app = () => createApp()

const body = async (res: Response): Promise<GeoBody> => (await res.json()) as GeoBody

/** Hono's test client passes `cf` through on the Request when provided. */
function req(cf: Record<string, unknown> | undefined) {
  const r = new Request("http://x/store/geo")
  if (cf) Object.defineProperty(r, "cf", { value: cf })
  return r
}

describe("GET /store/geo", () => {
  beforeEach(() => resetRateLimits())

  it("resolves a Ghana region from the Cloudflare region label", async () => {
    const res = await app().fetch(req({ country: "GH", region: "Greater Accra", city: "Accra" }))
    expect(res.status).toBe(200)
    expect(await body(res)).toEqual({
      country: "GH",
      region: "Greater Accra",
      regionId: "GH07",
      city: "Accra",
    })
  })

  it('tolerates the "<name> Region" label form', async () => {
    const res = await app().fetch(req({ country: "GH", region: "Ashanti Region" }))
    expect((await body(res)).regionId).toBe("GH02")
  })

  it("falls back to nearest region by coordinates when the label is unknown", async () => {
    // Kumasi — inside Ashanti.
    const res = await app().fetch(
      req({ country: "GH", region: "Somewhere Else", latitude: "6.6885", longitude: "-1.6244" }),
    )
    expect((await body(res)).regionId).toBe("GH02")
  })

  it("returns a null region for non-Ghana traffic", async () => {
    const res = await app().fetch(req({ country: "NG", region: "Lagos", city: "Lagos" }))
    const b = await body(res)
    expect(b.country).toBe("NG")
    expect(b.region).toBeNull()
  })

  it("returns nulls when Cloudflare attaches no geo at all", async () => {
    const res = await app().fetch(req(undefined))
    expect(res.status).toBe(200)
    expect(await body(res)).toEqual({ country: null, region: null, regionId: null, city: null })
  })

  it("never returns raw coordinates", async () => {
    const res = await app().fetch(
      req({ country: "GH", latitude: "5.6037", longitude: "-0.1870" }),
    )
    const b = await body(res)
    expect(b).not.toHaveProperty("latitude")
    expect(b).not.toHaveProperty("longitude")
  })

  it("is never cacheable — the answer varies per client IP", async () => {
    const res = await app().fetch(req({ country: "GH", region: "Greater Accra" }))
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
