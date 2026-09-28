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

describe("admin sign-in from the Access pass", () => {
  async function full() {
    const { createApp } = await import("../index")
    const { InMemoryAuthRepository } = await import("../auth-repository")
    const repo = new InMemoryAuthRepository()
    const app = createApp({ authRepo: repo, jwtSecret: "local-test-jwt-secret" })
    // Production sign-in routes need the auth rate limiter; this stand-in allows every request.
    const limiter = { idFromName: () => "id", get: () => ({ fetch: async () => Response.json({ allowed: true, retryAfter: 0 }) }) }
    return { repo, call: (path: string, init: RequestInit, env = PROD) => app.request(path, init, { ...env, AUTH_RATE_LIMITER: limiter, JWT_SECRET: "local-test-jwt-secret" } as never) }
  }

  it("signs an approved person in as their own admin account, created once", async () => {
    const s = await full()
    // The same Gmail may already shop on alkemart; the admin account stays separate.
    await s.repo.createUser({ id: "shopper", email: "owner@example.com", passwordHash: "x", role: "buyer" })
    const headers = { "Cf-Access-Jwt-Assertion": await sign({ email: "Owner@Example.com" }) }
    const first = await s.call("/admin/auth/access", { method: "POST", headers })
    expect(first.status).toBe(200)
    const body = await first.json() as { token: string; user: { email: string; role: string } }
    expect(body.user).toMatchObject({ email: "owner+console@example.com", role: "admin" })
    const again = await (await s.call("/admin/auth/access", { method: "POST", headers })).json() as { user: { id: string } }
    expect((await s.repo.findUserByEmail("owner+console@example.com"))!.id).toBe(again.user.id)
    expect((await s.repo.findUserByEmail("owner@example.com"))!.role).toBe("buyer")
    const me = await s.call("/admin/me", { headers: { ...headers, Authorization: `Bearer ${body.token}` } })
    expect(me.status).toBe(200)
  })

  it("refuses without a pass, for strangers, and outside production", async () => {
    const s = await full()
    expect((await s.call("/admin/auth/access", { method: "POST" })).status).toBe(403)
    expect((await s.call("/admin/auth/access", { method: "POST", headers: { "Cf-Access-Jwt-Assertion": await sign({ email: "stranger@example.com" }) } })).status).toBe(403)
    expect((await s.call("/admin/auth/access", { method: "POST" }, { ENVIRONMENT: "development" } as never)).status).toBe(404)
  })

  it("never lets the access-only admin account sign in with a password", async () => {
    const s = await full()
    await s.call("/admin/auth/access", { method: "POST", headers: { "Cf-Access-Jwt-Assertion": await sign({ email: "owner@example.com" }) } })
    const login = await s.call("/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "Cf-Access-Jwt-Assertion": await sign({ email: "owner@example.com" }) }, body: JSON.stringify({ email: "owner+console@example.com", password: "access-only" }) })
    expect(login.status).toBe(401)
  })
})
