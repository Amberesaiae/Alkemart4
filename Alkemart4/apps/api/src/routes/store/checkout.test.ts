import { describe, expect, it } from "vitest"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"

describe("checkout COD + MoMo", () => {
  it("two-seller COD creates OrderGroup with 2 orders", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const app = createApp({ repo: catalog, checkoutRepo, jwtSecret: "x".repeat(32) })

    const cartRes = await app.request("/store/cart", { method: "POST" })
    expect(cartRes.status).toBe(201)
    const { cartId } = (await cartRes.json()) as { cartId: string }

    for (const offerId of ["offer-a", "offer-b"]) {
      const add = await app.request(`/store/cart/${cartId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, qty: 1 }),
      })
      expect(add.status).toBe(201)
    }

    const checkout = await app.request("/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        method: "cod",
        buyerEmail: "buyer@alkemart.test",
      }),
    })
    expect(checkout.status).toBe(200)
    const body = (await checkout.json()) as {
      status: string
      orderGroupId: string
      orders: Array<{ sellerId: string }>
    }
    expect(body.status).toBe("completed")
    expect(body.orders).toHaveLength(2)
    expect(new Set(body.orders.map((o) => o.sellerId))).toEqual(
      new Set(["seller-a", "seller-b"]),
    )
  })

  it("MoMo pending reserves stock; missing key → 503", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)

    const noKey = createApp({
      repo: catalog,
      checkoutRepo,
      jwtSecret: "x".repeat(32),
      // paystackSecretKey omitted
    })
    const cartRes = await noKey.request("/store/cart", { method: "POST" })
    const { cartId } = (await cartRes.json()) as { cartId: string }
    await noKey.request(`/store/cart/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "offer-a", qty: 2 }),
    })
    const denied = await noKey.request("/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        method: "momo",
        buyerEmail: "buyer@alkemart.test",
        momo: { provider: "mtn", phone: "0244123456" },
      }),
    })
    expect(denied.status).toBe(503)

    const withKey = createApp({
      repo: catalog,
      checkoutRepo,
      jwtSecret: "x".repeat(32),
      paystackSecretKey: "sk_test",
      chargePaystackMobileMoney: async (_cfg, input) => ({
        status: "pending",
        reference: input.reference,
        data: {},
      }),
    })
    const before = snapshot.offers.find((o) => o.id === "offer-a")!
    expect(before.reserved).toBe(0)

    const pending = await withKey.request("/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        method: "momo",
        buyerEmail: "buyer@alkemart.test",
        momo: { provider: "mtn", phone: "0244123456" },
      }),
    })
    expect(pending.status).toBe(200)
    const pendingBody = (await pending.json()) as { status: string }
    expect(pendingBody.status).toBe("pending")
    expect(before.reserved).toBe(2)
  })
})
