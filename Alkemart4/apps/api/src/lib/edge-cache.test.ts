import { Hono } from "hono"
import { describe, expect, it } from "vitest"
import { edgeCache, noStoreHeaders } from "./edge-cache.js"

function appWith(...mw: never[]) {
  const app = new Hono()
  app.use("*", ...mw)
  app.get("/public", (c) => {
    edgeCache(c, "catalog")
    return c.json({ ok: true })
  })
  app.get("/private", (c) => c.json({ ok: true }))
  return app
}

describe("CDN cache policy", () => {
  it("marks public reads cacheable with edge TTL + SWR", async () => {
    const res = await appWith().request("/public")
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=6, s-maxage=60, stale-while-revalidate=300",
    )
  })

  it("marks private surfaces no-store", async () => {
    const res = await appWith(noStoreHeaders as never).request("/private")
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })

  it("route-level public header wins over mount-level no-store", async () => {
    const res = await appWith(noStoreHeaders as never).request("/public")
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60")
  })

  it("uses longer TTLs for slow-moving kinds", async () => {
    const probe = new Hono()
    probe.get("/merch", (c) => {
      edgeCache(c, "merchandising")
      return c.json({ ok: true })
    })
    probe.get("/build", (c) => {
      edgeCache(c, "build")
      return c.json({ ok: true })
    })
    const merch = await probe.request("/merch")
    const build = await probe.request("/build")
    expect(merch.headers.get("Cache-Control")).toContain("s-maxage=300")
    expect(build.headers.get("Cache-Control")).toContain("s-maxage=600")
  })
})
