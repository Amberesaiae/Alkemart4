import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const DAY = 86_400_000

/** The demo phone plus a second product, so there are two things to compare. */
async function world() {
  resetRateLimits()
  const snapshot = demoCatalog()
  snapshot.products.push({ ...snapshot.products[0]!, id: "prod-itel-a70", title: "itel A70" })
  snapshot.variants.push({ ...snapshot.variants[0]!, id: "var-itel-a70", productId: "prod-itel-a70", sku: "ITEL-A70" })
  snapshot.offers.push({ ...snapshot.offers[0]!, id: "offer-itel", productId: "prod-itel-a70", variantId: "var-itel-a70", pricePesewas: 1200n })
  const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({ id: "buyer-1", email: "ama@t.test", passwordHash: await hashPassword("BuyerPass1"), role: "buyer" })
  await authRepo.createUser({ id: "buyer-2", email: "kofi@t.test", passwordHash: await hashPassword("BuyerPass1"), role: "buyer" })
  const app = createApp({ repo: new InMemoryCatalogRepository(snapshot), checkoutRepo, authRepo, jwtSecret: JWT })
  const as = (token: string | null) => async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: res.status, body: (await res.json()) as Record<string, unknown> }
  }
  return {
    checkoutRepo,
    ama: as(await signSessionJwt({ userId: "buyer-1", role: "buyer" }, JWT)),
    kofi: as(await signSessionJwt({ userId: "buyer-2", role: "buyer" }, JWT)),
    guest: as(null),
  }
}

const both = { productIds: ["prod-tecno-spark", "prod-itel-a70"] }

// Compare is not mounted for the first deploy; un-skip when it is.
describe.skip("⚖ compare mode", () => {
  it("gives a new buyer 5 tokens; opening a comparison uses one and reopening is free", async () => {
    const w = await world()
    expect((await w.ama("GET", "/store/compare/tokens")).body).toMatchObject({ balance: 5, grant: 5, maxItems: 4 })
    const opened = await w.ama("POST", "/store/compare", both)
    expect(opened.status).toBe(201)
    expect(opened.body.tokens).toMatchObject({ balance: 4 })

    const id = opened.body.id as string
    const view = await w.ama("GET", `/store/compare/${id}`)
    const cols = view.body.columns as { productId: string; shops: number; best: { pricePesewas: string; totalPesewas: string } | null }[]
    expect(cols.map((c) => c.productId)).toEqual(both.productIds)
    // The phone has two shops; the best is the cheapest delivered total.
    expect(cols[0]!.shops).toBe(2)
    expect(cols[0]!.best?.pricePesewas).toBe("1500")
    expect((await w.ama("GET", `/store/compare/${id}`)).body.tokens).toMatchObject({ balance: 4 })
    // Someone else's comparison stays private.
    expect((await w.kofi("GET", `/store/compare/${id}`)).status).toBe(404)
  })

  it("needs a signed-in buyer and 2–4 products", async () => {
    const w = await world()
    expect((await w.guest("POST", "/store/compare", both)).status).toBe(401)
    expect((await w.ama("POST", "/store/compare", { productIds: ["prod-tecno-spark"] })).status).toBe(400)
    expect((await w.ama("POST", "/store/compare", { productIds: ["prod-tecno-spark", "nope"] })).status).toBe(404)
  })

  it("stops at zero and tops back up to 5 after two weeks", async () => {
    const w = await world()
    for (let i = 0; i < 5; i++) expect((await w.ama("POST", "/store/compare", both)).status).toBe(201)
    const out = await w.ama("POST", "/store/compare", both)
    expect(out.status).toBe(402)
    expect(String(out.body.error ?? out.body.message)).toMatch(/used your compares/)
    const later = new Date(Date.now() + 15 * DAY)
    w.checkoutRepo.now = () => later
    expect((await w.ama("GET", "/store/compare/tokens")).body).toMatchObject({ balance: 5 })
  })
})
