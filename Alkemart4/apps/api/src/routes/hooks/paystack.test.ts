import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"

const SECRET = "sk_test_webhook"

function sign(body: string) {
  return createHmac("sha512", SECRET).update(body).digest("hex")
}

describe("POST /hooks/paystack", () => {
  it("rejects bad HMAC and confirms MoMo idempotently", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const dedupStore = new Map<string, string>()
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: catalog,
      checkoutRepo,
      jwtSecret: "x".repeat(32),
      paystackSecretKey: SECRET,
      chargePaystackMobileMoney: async (_cfg, input) => ({
        status: "pending",
        reference: input.reference,
        data: {},
      }),
      verifyPaystackTransaction: async (_cfg, reference) => ({
        status: "success",
        amount: Number(snapshot.offers.find((o) => o.id === "offer-a")!.pricePesewas + snapshot.sellers[0]!.deliveryFeePesewas),
        reference,
        raw: {},
      }),
      webhookDedup: {
        get: async (k) => dedupStore.get(k) ?? null,
        put: async (k, v) => {
          dedupStore.set(k, v)
        },
      },
    })

    const cartRes = await app.request("/store/cart", { method: "POST" })
    const { cartId } = (await cartRes.json()) as { cartId: string }
    await app.request(`/store/cart/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "offer-a", qty: 1 }),
    })
    const checkout = await app.request("/store/checkout", {
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
    expect(checkout.status).toBe(200)
    const pending = (await checkout.json()) as {
      paymentIntentId: string
      paystackReference: string
    }

    const quote = await checkoutRepo.quote(cartId)
    // Fix verify amount to match intent
    const app2 = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: catalog,
      checkoutRepo,
      jwtSecret: "x".repeat(32),
      paystackSecretKey: SECRET,
      verifyPaystackTransaction: async (_cfg, reference) => ({
        status: "success",
        amount: Number(quote.totalPesewas),
        reference,
        raw: {},
      }),
      webhookDedup: {
        get: async (k) => dedupStore.get(k) ?? null,
        put: async (k, v) => {
          dedupStore.set(k, v)
        },
      },
    })

    const payload = JSON.stringify({
      event: "charge.success",
      data: { id: 99, reference: pending.paystackReference },
    })

    const bad = await app2.request("/hooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": "deadbeef", "Content-Type": "application/json" },
      body: payload,
    })
    expect(bad.status).toBe(401)

    const ok = await app2.request("/hooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": sign(payload), "Content-Type": "application/json" },
      body: payload,
    })
    expect(ok.status).toBe(200)

    const intent = await checkoutRepo.getPaymentIntent(pending.paymentIntentId)
    expect(intent?.status).toBe("completed")
    const group = await checkoutRepo.getOrderGroupByPaymentIntent(pending.paymentIntentId)
    expect(group).not.toBeNull()
    const orders = await checkoutRepo.listOrdersForGroup(group!.id)
    expect(orders).toHaveLength(1)

    const again = await app2.request("/hooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": sign(payload), "Content-Type": "application/json" },
      body: payload,
    })
    expect(again.status).toBe(200)
    const againBody = (await again.json()) as { deduped?: boolean }
    expect(againBody.deduped).toBe(true)
  })
})
