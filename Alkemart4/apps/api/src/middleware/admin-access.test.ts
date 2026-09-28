import { beforeAll, describe, expect, it } from "vitest"
import { Hono } from "hono"
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose"
import { requireAdminAccess, setAccessKeysForTest } from "./admin-access"
import type { AppEnv } from "../context"

function app() {
  const router = new Hono<AppEnv>()
  router.use("/admin/*", requireAdminAccess)
  router.get("/admin/me", (c) => c.json({ ok: true }))
  router.get("/store/catalog", (c) => c.json({ ok: true }))
  return router
}

const TEAM = "https://team.cloudflareaccess.com"
const AUD = "admin-aud"
const PROD = { ENVIRONMENT: "production", ADMIN_ACCESS_TEAM: TEAM, ADMIN_ACCESS_AUD: AUD, ADMIN_ACCESS_EMAILS: "owner@example.com, Ops@Example.com" } as AppEnv["Bindings"]
let sign: (claims: Record<string, unknown>, aud?: string, iss?: string) => Promise<string>

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256")
  setAccessKeysForTest(TEAM, createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: "RS256", kid: "k1" }] }) as never)
  sign = (claims, aud = AUD, iss = TEAM) => new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime("5m").sign(privateKey)
})

describe("admin Access gate", () => {
  it("admits a signed assertion for an approved identity", async () => {
    const assertion = await sign({ email: "ops@example.com" })
    const response = await app().request("/admin/me", { headers: { "Cf-Access-Jwt-Assertion": assertion } }, PROD)
    expect(response.status).toBe(200)
  })

  it("rejects signed assertions for other identities, audiences or issuers", async () => {
    for (const assertion of [
      await sign({ email: "stranger@example.com" }),
      await sign({ email: "owner@example.com" }, "preview-aud"),
      await sign({ email: "owner@example.com" }, AUD, "https://other.cloudflareaccess.com"),
    ]) {
      const response = await app().request("/admin/me", { headers: { "Cf-Access-Jwt-Assertion": assertion } }, PROD)
      expect(response.status).toBe(403)
    }
  })

  it("fails closed when production has no Access configuration", async () => {
    const response = await app().request("/admin/me", {}, { ENVIRONMENT: "production" } as AppEnv["Bindings"])
    expect(response.status).toBe(503)
  })

  it("rejects production admin requests with no signed assertion", async () => {
    const response = await app().request("/admin/me", {}, PROD)
    expect(response.status).toBe(403)
  })

  it("rejects malformed assertions rather than trusting a claimed email", async () => {
    const response = await app().request("/admin/me", {
      headers: { "Cf-Access-Jwt-Assertion": "forged", "Cf-Access-Authenticated-User-Email": "isaiahamber5@gmail.com" },
    }, PROD)
    expect(response.status).toBe(403)
  })

  it("does not gate local admin or public store routes", async () => {
    expect((await app().request("/admin/me", {}, { ENVIRONMENT: "development" } as AppEnv["Bindings"])).status).toBe(200)
    expect((await app().request("/store/catalog", {}, { ENVIRONMENT: "production" } as AppEnv["Bindings"])).status).toBe(200)
  })
})
