import { describe, expect, it } from "vitest"
import { hashPassword } from "@alkemart/domain"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"

describe("checkout COD + MoMo", () => {
  it("two-seller COD creates OrderGroup with 2 orders", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: catalog,
      checkoutRepo,
      jwtSecret: "x".repeat(32),
    })

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
        shippingAddress: { first_name: "Ama", last_name: "Mensah", phone: "0244123456", address_1: "12 High St", city: "Accra", country_code: "gh" },
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
      authRepo: new InMemoryAuthRepository(),
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
        shippingAddress: { first_name: "Ama", last_name: "Mensah", phone: "0244123456", address_1: "12 High St", city: "Accra", country_code: "gh" },
        momo: { provider: "mtn", phone: "0244123456" },
      }),
    })
    expect(denied.status).toBe(503)

    const withKey = createApp({
      authRepo: new InMemoryAuthRepository(),
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
        shippingAddress: { first_name: "Ama", last_name: "Mensah", phone: "0244123456", address_1: "12 High St", city: "Accra", country_code: "gh" },
        momo: { provider: "mtn", phone: "0244123456" },
      }),
    })
    expect(pending.status).toBe(200)
    const pendingBody = (await pending.json()) as { status: string }
    expect(pendingBody.status).toBe("pending")
    expect(before.reserved).toBe(2)
  })

  it("MoMo reserves before charge and releases when Paystack fails", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    let chargeCalls = 0

    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: catalog,
      checkoutRepo,
      jwtSecret: "x".repeat(32),
      paystackSecretKey: "sk_test",
      chargePaystackMobileMoney: async () => {
        chargeCalls += 1
        throw new Error("Paystack unavailable")
      },
    })

    const cartRes = await app.request("/store/cart", { method: "POST" })
    const { cartId } = (await cartRes.json()) as { cartId: string }
    await app.request(`/store/cart/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "offer-a", qty: 1 }),
    })

    const offer = snapshot.offers.find((o) => o.id === "offer-a")!
    const failed = await app.request("/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        method: "momo",
        buyerEmail: "buyer@alkemart.test",
        shippingAddress: {
          first_name: "Ama",
          last_name: "Mensah",
          phone: "0244123456",
          address_1: "12 High St",
          city: "Accra",
          country_code: "gh",
        },
        momo: { provider: "mtn", phone: "0244123456" },
      }),
    })
    expect(failed.status).toBe(502)
    expect(chargeCalls).toBe(1)
    // Stock held for the charge attempt, then released on Paystack failure.
    expect(offer.reserved).toBe(0)
  })
})

describe("paused seller guard", () => {
  it("409s order creation when a cart seller is paused", async () => {
    const authRepo = new InMemoryAuthRepository()
    await authRepo.registerVendor({
      user: { id: "u-paused", email: "paused@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
      seller: { id: "seller-a", handle: "seller-a", name: "Seller A" },
    })
    await authRepo.updateSellerAvailability("seller-a", {
      availability: "paused",
      pausedUntil: null,
      pauseNote: "Stock-taking",
    })

    const snapshot = demoCatalog()
    const app = createApp({
      authRepo,
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      jwtSecret: "x".repeat(32),
    })
    const env = {
      ENVIRONMENT: "development",
      JWT_SECRET: "x".repeat(32),
      HYPERDRIVE: { connectionString: "postgres://x" },
      HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
      CATALOG_KV: {},
    } as never

    const cartRes = await app.request("/store/cart", { method: "POST" }, env)
    expect(cartRes.status).toBe(201)
    const { cartId } = (await cartRes.json()) as { cartId: string }
    const add = await app.request(`/store/cart/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "offer-a", qty: 1 }),
    }, env)
    expect(add.status).toBe(201)

    const checkout = await app.request("/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        method: "cod",
        buyerEmail: "buyer@alkemart.test",
        shippingAddress: { first_name: "Ama", last_name: "Mensah", phone: "0244123456", address_1: "12 High St", city: "Accra", country_code: "gh" },
      }),
    }, env)
    expect(checkout.status).toBe(409)
    const body = (await checkout.json()) as { error?: string; message?: string }
    expect(JSON.stringify(body)).toMatch(/paused/)
  })
})
