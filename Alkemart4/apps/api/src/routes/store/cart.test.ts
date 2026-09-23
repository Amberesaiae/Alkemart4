import { describe, expect, it } from "vitest"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

describe("store cart", () => {
  it("requires offerId and quotes multi-seller cart", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const app = createApp({ repo: catalog, checkoutRepo, jwtSecret: "x".repeat(32) })

    const cartRes = await app.request("/store/cart", { method: "POST" })
    const { cartId } = (await cartRes.json()) as { cartId: string }

    const bad = await app.request(`/store/cart/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qty: 1 }),
    })
    expect(bad.status).toBe(400)

    const add = await app.request(`/store/cart/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "offer-a", qty: 1 }),
    })
    expect(add.status).toBe(201)

    const get = await app.request(`/store/cart/${cartId}`)
    expect(get.status).toBe(200)
    const body = (await get.json()) as {
      items: Array<{ offerId: string }>
      quote: { totalPesewas: string }
    }
    expect(body.items[0]?.offerId).toBe("offer-a")
    expect(BigInt(body.quote.totalPesewas)).toBeGreaterThan(0n)
  })
})
