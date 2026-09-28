import { describe, expect, it } from "vitest"
import { Hono } from "hono"
import { corsMiddleware } from "./cors"
import type { AppEnv } from "../context"

async function request(origin: string, environment = "production", method = "GET") {
  const app = new Hono<AppEnv>()
  app.use("*", corsMiddleware)
  app.get("/", (c) => c.json({ ok: true }))
  return app.request("/", { method, headers: { Origin: origin } }, { ENVIRONMENT: environment } as AppEnv["Bindings"])
}

describe("production CORS origins", () => {
  for (const origin of ["https://alkemart.com", "https://sell.alkemart.com", "https://console.alkemart.com"]) {
    it(`allows exact ${origin}`, async () => {
      expect((await request(origin)).headers.get("Access-Control-Allow-Origin")).toBe(origin)
    })
  }
  for (const origin of ["http://localhost:5176", "https://alkemart.vercel.app", "https://evil.alkemart.com", "https://preview.alkemart4-admin.pages.dev", "https://alkemart.com.evil.example"]) {
    it(`does not grant CORS to ${origin}`, async () => {
      for (const method of ["GET", "OPTIONS"]) {
        const response = await request(origin, "production", method)
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
        expect(response.headers.get("Vary")).toBe("Origin")
      }
    })
  }
  it("permits localhost only in explicit development", async () => {
    expect((await request("http://localhost:5176", "development")).headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5176")
  })
})
