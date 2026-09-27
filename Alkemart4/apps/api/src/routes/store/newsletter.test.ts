import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
import { newsletterToken } from "./newsletter"
resetRateLimits()

const SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function world() {
  const snapshot = demoCatalog()
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo: new InMemoryAuthRepository(), jwtSecret: SECRET })
  const post = (path: string, body: unknown) =>
    app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, { ENVIRONMENT: "development" })
  return { checkoutRepo, post }
}

describe("newsletter (double opt-in)", () => {
  it("sends one confirm email, refuses forged links, confirms and unsubscribes", async () => {
    const w = world()
    expect((await w.post("/store/newsletter", { email: "Ama@Example.com", source: "footer" })).status).toBe(200)
    await w.post("/store/newsletter", { email: "ama@example.com" }) // pressed twice
    // The signup drains the outbox straight away, so read every row (sent or not).
    const all = [...(w.checkoutRepo as unknown as { notifications: Map<string, { key: string; recipient: string; body: string }> }).notifications.values()]
    const confirms = all.filter((n) => n.key.startsWith("newsletter-confirm:"))
    expect(confirms).toHaveLength(1)
    expect(confirms[0]!.recipient).toBe("ama@example.com")
    expect(confirms[0]!.body).not.toContain("ama@example.com/")

    expect((await w.post("/store/newsletter/confirm", { token: "YW1hQGV4YW1wbGUuY29t.deadbeefdeadbeef" })).status).toBe(400)
    const confirm = await newsletterToken(SECRET, "confirm", "ama@example.com")
    expect(await (await w.post("/store/newsletter/confirm", { token: confirm })).json()).toEqual({ ok: true })
    // A confirm token can't be used to unsubscribe (actions are bound).
    expect((await w.post("/store/newsletter/unsubscribe", { token: confirm })).status).toBe(400)
    const unsub = await newsletterToken(SECRET, "unsubscribe", "ama@example.com")
    expect((await w.post("/store/newsletter/unsubscribe", { token: unsub })).status).toBe(200)
  })

  it("rejects an invalid address", async () => {
    const w = world()
    expect((await w.post("/store/newsletter", { email: "not-an-email" })).status).toBe(400)
  })
})
