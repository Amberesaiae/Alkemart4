import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { decodeEmail } from "../../email"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"

resetRateLimits()
const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const env = { ENVIRONMENT: "development", STOREFRONT_URL: "https://shop.example" }

function setup() {
  const snapshot = demoCatalog()
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()
  // No-op job runner: emails stay in the outbox so the test can read them.
  const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo, jwtSecret: JWT, jobs: { publish: async () => {} } })
  const call = (path: string, init: RequestInit & { token?: string; json?: unknown } = {}) =>
    app.request(
      path,
      {
        method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
        },
        body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      },
      env,
    )
  const outbox = async () => {
    const claimed = await checkoutRepo.claimPendingNotifications(50, 5)
    return claimed.filter((n) => n.channel === "email")
  }
  return { call, outbox }
}

async function register(call: ReturnType<typeof setup>["call"], email = "ama@example.com") {
  const res = await call("/store/auth/register", { json: { email, password: "Password1" } })
  return ((await res.json()) as { token: string }).token
}

describe("buyer account", () => {
  it("profile read and update", async () => {
    const { call } = setup()
    const token = await register(call)
    const patched = await call("/store/account", { method: "PATCH", token, json: { firstName: "Ama", phone: "+233 24 123 4567" } })
    expect(patched.status).toBe(200)
    const me = (await (await call("/store/account", { token })).json()) as { account: Record<string, string> }
    expect(me.account).toMatchObject({ email: "ama@example.com", firstName: "Ama", phone: "+233 24 123 4567" })
  })

  it("address book: first is default, one default at a time, deleting the default promotes another", async () => {
    const { call } = setup()
    const token = await register(call)
    const addr = { firstName: "Ama", lastName: "Mensah", phone: "0241234567", address1: "12 Ring Road", city: "Osu", countryCode: "GH" }
    const a = (await (await call("/store/account/addresses", { token, json: { ...addr, label: "Home" } })).json()) as { address: { id: string; isDefault: boolean } }
    expect(a.address.isDefault).toBe(true)
    const b = (await (await call("/store/account/addresses", { token, json: { ...addr, label: "Work", isDefault: true } })).json()) as { address: { id: string } }
    let list = (await (await call("/store/account/addresses", { token })).json()) as { addresses: { id: string; isDefault: boolean }[] }
    expect(list.addresses.filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.address.id])
    await call(`/store/account/addresses/${b.address.id}`, { method: "DELETE", token })
    list = (await (await call("/store/account/addresses", { token })).json()) as { addresses: { id: string; isDefault: boolean }[] }
    expect(list.addresses).toHaveLength(1)
    expect(list.addresses[0]).toMatchObject({ id: a.address.id, isDefault: true })
  })

  it("addresses are private to their owner", async () => {
    const { call } = setup()
    const t1 = await register(call, "one@example.com")
    const t2 = await register(call, "two@example.com")
    const a = (await (await call("/store/account/addresses", {
      token: t1,
      json: { firstName: "A", lastName: "B", phone: "0241234567", address1: "1 Road", city: "Osu", countryCode: "gh" },
    })).json()) as { address: { id: string } }
    expect((await call(`/store/account/addresses/${a.address.id}`, { method: "DELETE", token: t2 })).status).toBe(404)
    const seen = (await (await call("/store/account/addresses", { token: t2 })).json()) as { addresses: unknown[] }
    expect(seen.addresses).toHaveLength(0)
  })

  it("changing the password needs the current one and retires older sessions", async () => {
    const { call, outbox } = setup()
    const old = await register(call)
    const bad = await call("/store/account/password", { token: old, json: { currentPassword: "nope", newPassword: "NewPassword1" } })
    expect(bad.status).toBe(400)
    await new Promise((r) => setTimeout(r, 1100)) // a session from an earlier second
    const older = old
    const ok = await call("/store/account/password", { token: older, json: { currentPassword: "Password1", newPassword: "NewPassword1" } })
    expect(ok.status).toBe(200)
    const fresh = ((await ok.json()) as { token: string }).token
    expect((await call("/store/account", { token: fresh })).status).toBe(200)
    expect((await call("/store/account", { token: older })).status).toBe(401)
    const mails = await outbox()
    expect(mails.map((m) => decodeEmail(m.body).subject)).toContain("Your password was changed")
  })

  it("password reset: same answer for unknown emails, emailed single-use link works once", async () => {
    const { call, outbox } = setup()
    await register(call)
    const unknown = await call("/store/auth/password-reset/request", { json: { email: "nobody@example.com" } })
    const known = await call("/store/auth/password-reset/request", { json: { email: "ama@example.com" } })
    expect(unknown.status).toBe(202)
    expect(known.status).toBe(202)
    expect(await unknown.json()).toEqual(await known.json())

    const mail = (await outbox()).find((m) => decodeEmail(m.body).subject === "Reset your password")!
    expect(mail.recipient).toBe("ama@example.com")
    const { text } = decodeEmail(mail.body)
    // Link host comes from STOREFRONT_URL config, never from request headers.
    const token = /https:\/\/shop\.example\/reset-password\?token=([0-9a-f]{64})/.exec(text)![1]!

    const first = await call("/store/auth/password-reset/confirm", { json: { token, password: "Brandnew123" } })
    expect(first.status).toBe(200)
    const reuse = await call("/store/auth/password-reset/confirm", { json: { token, password: "Another123" } })
    expect(reuse.status).toBe(400)
    const login = await call("/store/auth/login", { json: { email: "ama@example.com", password: "Brandnew123" } })
    expect(login.status).toBe(200)
  })

  it("sellers can't use the buyer reset door (and vice versa)", async () => {
    const { call, outbox } = setup()
    await call("/vendor/auth/register", { json: { email: "shop@example.com", password: "Password1", sellerName: "Shop", sellerHandle: "shop" } })
    await call("/store/auth/password-reset/request", { json: { email: "shop@example.com" } })
    expect(await outbox()).toHaveLength(0)
    await call("/vendor/auth/password-reset/request", { json: { email: "shop@example.com" } })
    const mail = (await outbox())[0]!
    expect(decodeEmail(mail.body).text).toContain("/reset-password?token=")
  })
})
