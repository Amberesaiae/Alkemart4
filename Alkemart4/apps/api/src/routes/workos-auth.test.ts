import { beforeEach, describe, expect, it, vi } from "vitest"
import { hashPassword } from "@alkemart/domain"
import { createApp } from "../index"
import { InMemoryAuthRepository } from "../auth-repository"
import { InMemoryWorkosStore } from "../workos-store"
import { resetRateLimits } from "../middleware/security"
import { openWorkosData, sealWorkosData } from "../lib/workos-session"
import { signSessionJwt } from "../lib/jwt"

const secret = "test-workos-cookie-secret-at-least-32-characters"
const env = {
  ENVIRONMENT: "development", WORKOS_ENABLED: "1", WORKOS_API_KEY: "test-key", WORKOS_CLIENT_ID: "client_test",
  WORKOS_COOKIE_SECRET: secret, WORKOS_API_ORIGIN: "http://localhost:8787",
  STOREFRONT_URL: "http://localhost:5176", VENDOR_URL: "http://localhost:3004",
}
const identity = { id: "user_workos", email: "buyer@example.com", email_verified: true }
function provider(user = identity) { return vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ user, access_token: `e30.${btoa(JSON.stringify({ sub: user.id, sid: "session_test", exp: Math.floor(Date.now() / 1000) + 300 }))}.signature`, refresh_token: "provider-refresh" })) }
function setup(user = identity) {
  const repo = new InMemoryAuthRepository()
  const store = new InMemoryWorkosStore(repo)
  const fetcher = provider(user)
  const app = createApp({ authRepo: repo, workosStore: store, workosFetch: fetcher, jwtSecret: "local-test-jwt-secret" })
  const call = (path: string, options: RequestInit = {}, configuration = env) => app.request(path, options, configuration as never)
  return { repo, store, fetcher, app, call }
}
const cookie = (response: Response) => response.headers.get("set-cookie")!.split(";")[0]!
async function begin(s: ReturnType<typeof setup>, actor: "store" | "vendor" = "store", body: unknown = {}) {
  const response = await s.call(`/${actor}/auth/workos/start`, { method: "POST", headers: { Origin: actor === "store" ? env.STOREFRONT_URL : env.VENDOR_URL, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  expect(response.status).toBe(200)
  const url = new URL((await response.json() as { url: string }).url)
  const callback = `/${actor}/auth/workos/callback?state=${url.searchParams.get("state")}&code=valid-code`
  return { callback, cookie: cookie(response) }
}
async function complete(s: ReturnType<typeof setup>, actor: "store" | "vendor" = "store", body: unknown = {}) {
  const attempt = await begin(s, actor, body)
  const result = await s.call(attempt.callback, { headers: { Cookie: attempt.cookie } })
  expect(result.status).toBe(302)
  // Hono may append attempt deletion and session cookies to the same header.
  const cookies = result.headers.get("set-cookie") ?? ""
  const match = cookies.match(/alkemart_(?:store|vendor)_session=([^; ,]+)/)
  return { response: result, cookie: match ? `alkemart_${actor}_session=${match[1]}` : "", attempt }
}
async function restore(s: ReturnType<typeof setup>, sessionCookie: string, actor: "store" | "vendor" = "store") {
  const response = await s.call(`/${actor}/auth/workos/session`, { method: "POST", headers: { Cookie: sessionCookie, Origin: actor === "store" ? env.STOREFRONT_URL : env.VENDOR_URL } })
  return { response, data: await response.json() as { token: string; user: { id: string; role: string; sellerId?: string } } }
}

describe("WorkOS marketplace authentication", () => {
  beforeEach(resetRateLimits)
  it("rejects legacy marketplace bearer tokens after cutover", async () => {
    const s = setup()
    await s.repo.createUser({ id: "legacy-buyer", email: "old@example.com", passwordHash: "old", role: "buyer" })
    await s.repo.markEmailVerified("legacy-buyer")
    const token = await signSessionJwt({ userId: "legacy-buyer", role: "buyer", pwd: 0 }, "local-test-jwt-secret")
    const result = await s.call("/store/account/me", { headers: { Authorization: `Bearer ${token}` } })
    expect(result.status).toBe(401)
  })
  it("is disabled by default, without touching the provider", async () => {
    const s = setup()
    const result = await s.call("/store/auth/workos/start", { method: "POST" }, { ...env, WORKOS_ENABLED: "0" })
    expect(result.status).toBe(404)
    expect(s.fetcher).not.toHaveBeenCalled()
  })
  it("fails closed without production same-site configuration", async () => {
    const s = setup()
    const result = await s.call("/store/auth/workos/config", {}, { ...env, ENVIRONMENT: "production", WORKOS_API_ORIGIN: "https://api.workers.dev", STOREFRONT_URL: "https://shop.pages.dev" })
    expect(result.status).toBe(503)
  })
  it("accepts the configured same-origin Pages bridge without third-party cookies", async () => {
    const s = setup()
    const result = await s.call("/store/auth/workos/config", {}, { ...env, ENVIRONMENT: "production", WORKOS_API_ORIGIN: "https://shop.pages.dev", STOREFRONT_URL: "https://shop.pages.dev" })
    expect(result.status).toBe(200)
  })
  it("requires an exact configured Origin on cookie-authorized writes", async () => {
    const s = setup()
    const result = await s.call("/store/auth/workos/start", { method: "POST", headers: { Origin: "https://attacker.example" }, body: "{}" })
    expect(result.status).toBe(403)
    expect(s.fetcher).not.toHaveBeenCalled()
  })
  it("rejects missing browser binding without consuming the valid attempt", async () => {
    const s = setup()
    const attempt = await begin(s)
    const rejected = await s.call(attempt.callback)
    expect(rejected.headers.get("location")).toContain("invalid_state")
    expect(s.fetcher).not.toHaveBeenCalled()
    expect((await s.call(attempt.callback, { headers: { Cookie: attempt.cookie } })).headers.get("location")).toBe(`${env.STOREFRONT_URL}/account`)
  })
  it("consumes callback state once and never puts tokens in the redirect", async () => {
    const s = setup()
    const completed = await complete(s)
    expect(completed.response.headers.get("location")).toBe(`${env.STOREFRONT_URL}/account`)
    expect(completed.response.headers.get("set-cookie")).toContain("HttpOnly")
    expect(completed.cookie).not.toContain("provider-refresh")
    const replay = await s.call(completed.attempt.callback, { headers: { Cookie: completed.attempt.cookie } })
    expect(replay.headers.get("location")).toContain("invalid_state")
    expect(s.fetcher).toHaveBeenCalledTimes(1)
  })
  it.each(["//evil.example", "/\\evil.example", "/\nmalicious"])("rejects unsafe return path %s", async (redirect) => {
    const s = setup()
    expect((await complete(s, "store", { redirect })).response.headers.get("location")).toBe(`${env.STOREFRONT_URL}/account`)
  })
  it("issues bounded access, checks revocation immediately, and blocks local auth bypass", async () => {
    const s = setup()
    const completed = await complete(s)
    const session = await restore(s, completed.cookie)
    expect(session.response.status).toBe(200)
    const payload = JSON.parse(atob(session.data.token.split(".")[1]!))
    expect(payload.exp - payload.iat).toBe(300)
    expect(payload.sid).toBeTruthy()
    const headers = { Authorization: `Bearer ${session.data.token}` }
    expect((await s.call("/store/account", { headers })).status).toBe(200)
    expect((await s.call("/store/auth/login", { method: "POST", body: "{}" })).status).toBe(409)
    expect((await s.call("/store/auth/password-reset/request", { method: "POST", body: "{}" })).status).toBe(409)
    expect((await s.call("/store/auth/workos/logout", { method: "POST", headers: { Cookie: completed.cookie, Origin: env.STOREFRONT_URL } })).status).toBe(200)
    expect((await s.call("/store/account", { headers })).status).toBe(401)
  })
  it("does not auto-link an existing email", async () => {
    const s = setup()
    const old = await s.repo.createUser({ id: "legacy", email: identity.email, passwordHash: "old", role: "buyer" })
    const result = await complete(s)
    expect(result.response.headers.get("location")).toContain("account_link_required")
    expect(result.cookie).toBe("")
    expect(old.emailVerifiedAt).toBeUndefined()
  })
  it("links only with old-account proof and keeps the local ID", async () => {
    const s = setup()
    await s.repo.createUser({ id: "legacy", email: identity.email, passwordHash: await hashPassword("LegacyPassword1"), role: "buyer" })
    const result = await complete(s, "store", { link: { email: identity.email, password: "LegacyPassword1" } })
    expect((await restore(s, result.cookie)).data.user.id).toBe("legacy")
  })
  it("rejects an account changed during linking", async () => {
    const s = setup()
    await s.repo.createUser({ id: "legacy", email: identity.email, passwordHash: await hashPassword("LegacyPassword1"), role: "buyer" })
    const attempt = await begin(s, "store", { link: { email: identity.email, password: "LegacyPassword1" } })
    await s.repo.updateUserPassword("legacy", "new-password-hash")
    const result = await s.call(attempt.callback, { headers: { Cookie: attempt.cookie } })
    expect(result.headers.get("location")).toContain("account_link_invalid")
  })
  it("never upgrades provider users into local admin", async () => {
    const s = setup()
    await s.repo.createUser({ id: "admin", email: identity.email, passwordHash: await hashPassword("AdminPassword1"), role: "admin" })
    const start = await s.call("/store/auth/workos/start", { method: "POST", headers: { Origin: env.STOREFRONT_URL }, body: JSON.stringify({ link: { email: identity.email, password: "AdminPassword1" } }) })
    expect(start.status).toBe(401)
  })
  it("lets a buyer open a pending shop without losing their identity, then buy as the same person", async () => {
    const s = setup()
    const buyer = await complete(s)
    const buyerSession = await restore(s, buyer.cookie)
    const vendor = await complete(s, "vendor", { mode: "register", shop: { name: "My Shop", handle: "my-shop" } })
    const vendorSession = await restore(s, vendor.cookie, "vendor")
    expect(vendorSession.response.status).toBe(200)
    expect(vendorSession.data.user.id).toBe(buyerSession.data.user.id)
    expect((await s.repo.findSellerById(vendorSession.data.user.sellerId!))?.status).toBe("pending_approval")
    expect((await s.call("/store/account", { headers: { Authorization: `Bearer ${buyerSession.data.token}` } })).status).toBe(200)
    expect((await s.call("/vendor/sellers/me", { headers: { Authorization: `Bearer ${buyerSession.data.token}` } })).status).toBe(403)
  })
  it("revokes locally after a provider refresh rejects or changes identity", async () => {
    const s = setup()
    const result = await complete(s)
    s.fetcher.mockResolvedValue(Response.json({ user: { ...identity, id: "user_other" }, access_token: "access", refresh_token: "refresh" }))
    expect((await restore(s, result.cookie)).response.status).toBe(401)
    s.fetcher.mockResolvedValue(Response.json({ user: identity, access_token: "access", refresh_token: "refresh" }))
    expect((await restore(s, result.cookie)).response.status).toBe(401)
  })
  it("encrypts stored credentials and rejects tampering/wrong keys", async () => {
    const sealed = await sealWorkosData({ token: "secret-refresh" }, secret, 600)
    expect(sealed).not.toContain("secret-refresh")
    expect((await openWorkosData(sealed, secret)).token).toBe("secret-refresh")
    await expect(openWorkosData(sealed, "another-secret")).rejects.toThrow()
  })
})

describe("WorkOS sign-in on our own pages", () => {
  beforeEach(resetRateLimits)
  const json = (body: unknown, extra: Record<string, string> = {}) => ({ method: "POST", headers: { Origin: env.STOREFRONT_URL, "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) })
  const emailCookie = (response: Response) => (response.headers.get("set-cookie") ?? "").match(/alkemart_store_email=([^; ,]+)/)?.[0] ?? ""

  it("sends Google straight to Google, skipping the hosted page", async () => {
    const s = setup()
    const response = await s.call("/store/auth/workos/start", json({ provider: "google" }))
    const url = new URL((await response.json() as { url: string }).url)
    expect(url.searchParams.get("provider")).toBe("GoogleOAuth")
    expect(url.searchParams.get("screen_hint")).toBeNull()
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  })

  it("emails a code, lets a wrong code be retried, then signs in with the right one", async () => {
    const s = setup()
    s.fetcher.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith("/user_management/magic_auth")) return Response.json({ id: "magic_auth_1" })
      const body = JSON.parse(String(init?.body))
      if (body.grant_type !== "refresh_token") {
        if (body.code !== "123456") return new Response("{}", { status: 400 })
        expect(body.grant_type).toBe("urn:workos:oauth:grant-type:magic-auth:code")
        expect(body.email).toBe("buyer@example.com")
      }
      return Response.json({ user: identity, access_token: `e30.${btoa(JSON.stringify({ sub: identity.id, sid: "session_test", exp: Math.floor(Date.now() / 1000) + 300 }))}.signature`, refresh_token: "provider-refresh" })
    })
    const started = await s.call("/store/auth/workos/email/start", json({ email: " Buyer@Example.com " }))
    expect(started.status).toBe(200)
    const c = emailCookie(started)
    expect(c).toContain("alkemart_store_email=")
    expect(String(s.fetcher.mock.calls[0]![0])).toContain("/user_management/magic_auth")

    const wrong = await s.call("/store/auth/workos/email/verify", json({ code: "000000" }, { Cookie: c }))
    expect(wrong.status).toBe(400)

    const right = await s.call("/store/auth/workos/email/verify", json({ code: "123456" }, { Cookie: c }))
    expect(right.status).toBe(200)
    expect(await right.json()).toEqual({ redirect: "/account" })
    const session = (right.headers.get("set-cookie") ?? "").match(/alkemart_store_session=([^; ,]+)/)
    expect(session).not.toBeNull()
    const restored = await restore(s, `alkemart_store_session=${session![1]}`)
    expect(restored.response.status).toBe(200)
    expect(restored.data.user.role).toBe("buyer")

    // The code attempt is single use once it succeeds.
    const replay = await s.call("/store/auth/workos/email/verify", json({ code: "123456" }, { Cookie: c }))
    expect(replay.status).toBe(400)
  })

  it("stops accepting codes after too many wrong tries", async () => {
    const s = setup()
    s.fetcher.mockImplementation(async (input) => String(input).endsWith("/magic_auth") ? Response.json({}) : new Response("{}", { status: 400 }))
    const c = emailCookie(await s.call("/store/auth/workos/email/start", json({ email: "buyer@example.com" })))
    for (let i = 0; i < 5; i++) await s.call("/store/auth/workos/email/verify", json({ code: "000000" }, { Cookie: c }))
    const after = await s.call("/store/auth/workos/email/verify", json({ code: "123456" }, { Cookie: c }))
    expect(after.status).toBe(400)
    // Only the send plus five checks reached the provider; the sixth never did.
    expect(s.fetcher).toHaveBeenCalledTimes(6)
  })

  it("rejects verification without the browser's code cookie or from another site", async () => {
    const s = setup()
    s.fetcher.mockImplementation(async () => Response.json({}))
    await s.call("/store/auth/workos/email/start", json({ email: "buyer@example.com" }))
    expect((await s.call("/store/auth/workos/email/verify", json({ code: "123456" }))).status).toBe(400)
    expect((await s.call("/store/auth/workos/email/start", json({ email: "buyer@example.com" }, { Origin: "https://attacker.example" }))).status).toBe(403)
  })
})
