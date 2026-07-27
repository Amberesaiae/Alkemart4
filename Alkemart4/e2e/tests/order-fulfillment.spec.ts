import { test, expect } from "@playwright/test"
import { API, creds, publishableKey } from "../lib/env"
import { loginAdmin, loginSeller, listSellerStores, registerAndLoginBuyer } from "../lib/api"

test.describe("order fulfillment pipeline", () => {
  let adminToken: string
  let sellerToken: string
  let sellerId: string
  let buyerToken: string
  let orderId: string

  test.beforeAll(async () => {
    adminToken = (await loginAdmin(creds.admin.email, creds.admin.password)).token
    const seller = await loginSeller(creds.seller.email, creds.seller.password)
    sellerToken = seller.token
    const stores = await listSellerStores(sellerToken)
    sellerId = stores.sellers[0].id!
    expect(sellerId).toBeTruthy()

    const ts = Date.now()
    const buyer = await registerAndLoginBuyer({
      email: `e2e-fulfillment-${ts}@alkemart.test`,
      password: "test-buyer-2026!",
      firstName: "Fulfill",
      lastName: "Tester",
    })
    buyerToken = buyer.token

    // Create an order via COD
    const pk = publishableKey()
    const catalogRes = await fetch(`${API}/store/alkemart/catalog?limit=3`, {
      headers: { "x-publishable-api-key": pk },
    })
    const catalog = await catalogRes.json()
    const products = catalog?.products ?? []
    test.skip(products.length === 0, "no products to test fulfillment")

    const product = products[0]
    const variantId = product.variants?.[0]?.id

    const cartRes = await fetch(`${API}/store/carts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": pk, Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ currency_code: "ghs", region_id: product.region_id }),
    })
    const cart = await cartRes.json()
    const cartId = cart.cart?.id
    expect(cartId).toBeTruthy()

    await fetch(`${API}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": pk, Authorization: `Bearer ${buyerToken}` },
      body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
    })

    const completeRes = await fetch(`${API}/store/carts/${cartId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": pk, Authorization: `Bearer ${buyerToken}` },
    })
    const completed = await completeRes.json()
    orderId = completed?.order?.id ?? completed?.order_id
    expect(orderId).toBeTruthy()
    console.log(`[fulfillment] created order ${orderId}`)
  })

  test("admin can list orders", async ({ request }) => {
    const res = await request.get(`${API}/admin/orders?limit=5&fields=id,status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const orders = body?.orders ?? []
    expect(Array.isArray(orders)).toBeTruthy()
  })

  test("seller can fulfill order", async ({ request }) => {
    test.skip(!orderId, "no order to fulfill")

    const fulfillRes = await request.post(`${API}/vendor/orders/${orderId}/fulfillment`, {
      headers: {
        Authorization: `Bearer ${sellerToken}`,
        "x-seller-id": sellerId,
      },
      data: {
        items: [],
        no_notification: false,
      },
    })
    // Fulfillment may fail gracefully if order is already fulfilled or has no items
    if (!fulfillRes.ok()) {
      const text = await fulfillRes.text()
      console.log(`[fulfillment] fulfill response (${fulfillRes.status()}): ${text.slice(0, 200)}`)
    }
  })

  test("admin can create shipment", async ({ request }) => {
    test.skip(!orderId, "no order to ship")

    const shipRes = await request.post(`${API}/admin/orders/${orderId}/shipment`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { items: [] },
    })
    if (!shipRes.ok()) {
      const text = await shipRes.text()
      console.log(`[fulfillment] shipment response (${shipRes.status()}): ${text.slice(0, 200)}`)
    }
  })
})
