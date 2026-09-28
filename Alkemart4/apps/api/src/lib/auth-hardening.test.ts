import { beforeEach, describe, expect, it, vi } from "vitest"
import { Hono } from "hono"
import { hashPassword } from "@alkemart/domain"
import type { AppEnv } from "../context"
import { InMemoryAuthRepository } from "../auth-repository"
import { createApp } from "../index"
import { resetRateLimits } from "../middleware/security"
import { errorHandler } from "../middleware/error"
import { AuthRateLimiter, enforceGlobalLimit, type RateLimitNamespace } from "./auth-rate-limit"
import { signSessionJwt, verifySessionJwt } from "./jwt"
import { verifySignupChallenge } from "./turnstile"

const secret = "test-secret-not-a-production-credential-32"
beforeEach(() => { resetRateLimits(); vi.restoreAllMocks() })

describe("session hardening", () => {
  it("upgrades hashes by compare-and-swap without revoking sessions or undoing resets", async () => {
    const repo = new InMemoryAuthRepository()
    await repo.createUser({ id: "buyer", role: "buyer", email: "buyer@example.test", passwordHash: "old" })
    const upgraded = await repo.rehashUserPassword("buyer", "old", "new")
    expect(upgraded?.passwordChangedAt).toBeFalsy()
    await repo.updateUserPassword("buyer", "reset")
    expect(await repo.rehashUserPassword("buyer", "new", "stale-upgrade")).toBeNull()
    expect((await repo.findUserById("buyer"))?.passwordHash).toBe("reset")
  })
  it("issues one-hour admin sessions and rejects legacy seven-day admin tokens", async () => {
    const token = await signSessionJwt({ userId: "a", role: "admin" }, secret)
    const payload = JSON.parse(atob(token.split(".")[1]!))
    expect(payload.exp - payload.iat).toBe(3600)
    await expect(verifySessionJwt(token, secret)).resolves.toMatchObject({ role: "admin" })
    await expect(verifySessionJwt(await signSessionJwt({ userId: "a", role: "admin" }, secret, 604800), secret)).rejects.toThrow()
  })

  it.each(["admin", "seller_member"] as const)("revokes %s sessions after password changes, even within the same second", async (role) => {
    const repo = new InMemoryAuthRepository()
    const hash = await hashPassword("Local-only-test-pass")
    const user = role === "admin"
      ? await repo.createUser({ id: "a", email: "ops@example.test", passwordHash: hash, role })
      : (await repo.registerVendor({ user: { id: "s", email: "seller@example.test", passwordHash: hash }, seller: { id: "shop", name: "Shop", handle: "shop" } })).user
    const app = createApp({ authRepo: repo, jwtSecret: secret })
    const claims = { userId: user.id, role, pwd: 0, ...(role === "seller_member" ? { sellerId: "shop" } : {}) }
    const old = await signSessionJwt(claims, secret)
    const path = role === "admin" ? "/admin/me" : "/vendor/me"
    const request = (token: string) => app.request(path, { headers: { Authorization: `Bearer ${token}` } })
    expect((await request(old)).status).toBe(200)
    const changed = await repo.updateUserPassword(user.id, hash)
    expect((await request(old)).status).toBe(401)
    const fresh = await signSessionJwt({ ...claims, pwd: changed.passwordChangedAt!.getTime() }, secret)
    expect((await request(fresh)).status).toBe(200)
    user.role = "buyer"
    expect((await request(fresh)).status).toBe(401)
  })
})

describe("distributed rate limiter", () => {
  it("keeps counters across object recreation and resets only after the window", async () => {
    const values = new Map<string, unknown>()
    const storage = {
      get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value) },
      setAlarm: async () => {}, deleteAll: async () => { values.clear() },
      transaction: async (fn: (tx: unknown) => unknown) => fn(storage),
    }
    const state = { storage } as unknown as DurableObjectState
    const consume = async () => new AuthRateLimiter(state).fetch(new Request("https://internal/", { method: "POST", body: JSON.stringify({ limit: 2, windowMs: 1000 }) })).then((r) => r.json())
    expect(await consume()).toMatchObject({ allowed: true })
    expect(await consume()).toMatchObject({ allowed: true })
    expect(await consume()).toMatchObject({ allowed: false })
    await new AuthRateLimiter(state).alarm()
    expect(await consume()).toMatchObject({ allowed: true })
  })

  it("fails closed without production binding and returns Retry-After for denial", async () => {
    const app = new Hono<AppEnv>().onError(errorHandler).get("/", async (c) => {
      await enforceGlobalLimit(c, "test", "principal", 10, 60000)
      return c.json({ ok: true })
    })
    expect((await app.request("/", {}, { ENVIRONMENT: "production" } as AppEnv["Bindings"])).status).toBe(503)
    const namespace = { idFromName: vi.fn(() => "id"), get: () => ({ fetch: async () => Response.json({ allowed: false, retryAfter: 42 }) }) } as unknown as RateLimitNamespace
    const res = await app.request("/", {}, { ENVIRONMENT: "production", AUTH_RATE_LIMITER: namespace } as AppEnv["Bindings"])
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("42")
    expect(namespace.idFromName).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/))
  })
})

describe("signup verification", () => {
  const env = { ENVIRONMENT: "production", TURNSTILE_SECRET_KEY: "test-key", TURNSTILE_HOSTNAMES: "shop.example.test" } as AppEnv["Bindings"]
  const app = new Hono<AppEnv>().onError(errorHandler).post("/", async (c) => {
    await verifySignupChallenge(c, (await c.req.json()).token)
    return c.json({ ok: true })
  })
  const request = (token?: string) => app.request("/", { method: "POST", body: JSON.stringify({ token }) }, env)

  it("rejects missing tokens without calling verification", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch")
    expect((await request()).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([
    { success: false, hostname: "shop.example.test", action: "signup" },
    { success: true, hostname: "evil.test", action: "signup" },
    { success: true, hostname: "shop.example.test", action: "login" },
  ])("rejects invalid challenge result %j", async (result) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(result))
    expect((await request("test-token")).status).toBe(400)
  })
  it("accepts only verified signup tokens for an allowed hostname", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ success: true, hostname: "shop.example.test", action: "signup" }))
    expect((await request("test-token")).status).toBe(200)
  })
})
