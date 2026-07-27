import { test, expect } from "@playwright/test"
import { SHOP, SELLER, creds, publishableKey } from "../lib/env"
import { loginSeller, loginAdmin, registerAndLoginBuyer } from "../lib/api"

const API = process.env.API_URL ?? "http://localhost:9000"

test.describe("checkout flows", () => {
  let buyerToken: string
  let buyerEmail: string
  const buyerPassword = "test-buyer-2026!"

  test.beforeAll(async () => {
    const ts = Date.now()
    buyerEmail = `e2e-buyer-${ts}@alkemart.test`
    const r = await registerAndLoginBuyer({
      email: buyerEmail,
      password: buyerPassword,
      firstName: "E2E",
      lastName: "Buyer",
    })
    buyerToken = r.token
  })

  test("COD checkout — browse → add to cart → complete order", async ({ page, request }) => {
    const pk = publishableKey()
    expect(pk).toBeTruthy()

    // Browse catalog
    const catalogRes = await request.get(`${API}/store/alkemart/catalog?limit=5`, {
      headers: { "x-publishable-api-key": pk },
    })
    expect(catalogRes.ok()).toBeTruthy()
    const catalog = await catalogRes.json()
    const products = catalog?.products ?? []
    test.skip(products.length === 0, "no products in catalog to test checkout")

    const product = products[0]
    expect(product.id).toBeTruthy()

    // Add to cart
    const cartRes = await request.post(`${API}/store/carts`, {
      headers: {
        "x-publishable-api-key": pk,
        Authorization: `Bearer ${buyerToken}`,
      },
      data: {
        currency_code: "ghs",
        region_id: product.region_id,
      },
    })
    expect(cartRes.ok()).toBeTruthy()
    const cart = await cartRes.json()
    expect(cart.cart?.id).toBeTruthy()
    const cartId = cart.cart.id

    // Add line item
    const variantId = product.variants?.[0]?.id
    expect(variantId).toBeTruthy()
    const addRes = await request.post(`${API}/store/carts/${cartId}/line-items`, {
      headers: {
        "x-publishable-api-key": pk,
        Authorization: `Bearer ${buyerToken}`,
      },
      data: {
        variant_id: variantId,
        quantity: 1,
      },
    })
    expect(addRes.ok()).toBeTruthy()

    // Set shipping address
    const shipRes = await request.post(`${API}/store/carts/${cartId}/shipping-address`, {
      headers: {
        "x-publishable-api-key": pk,
        Authorization: `Bearer ${buyerToken}`,
      },
      data: {
        address: {
          first_name: "E2E",
          last_name: "Buyer",
          address_1: "123 Test St",
          city: "Accra",
          country_code: "gh",
          postal_code: "12345",
          phone: "+233500000000",
        },
      },
    })
    expect(shipRes.ok()).toBeTruthy()

    // Get shipping options
    const shipOptsRes = await request.get(
      `${API}/store/carts/${cartId}/shipping-options`,
      {
        headers: { "x-publishable-api-key": pk },
      },
    )
    expect(shipOptsRes.ok()).toBeTruthy()
    const shipOpts = await shipOptsRes.json()
    const standardShipping = shipOpts?.shipping_options?.find(
      (o: any) => o.name?.toLowerCase().includes("standard") || o.amount > 0,
    )
    if (standardShipping) {
      await request.post(`${API}/store/carts/${cartId}/shipping-methods`, {
        headers: {
          "x-publishable-api-key": pk,
          Authorization: `Bearer ${buyerToken}`,
        },
        data: { option_id: standardShipping.id },
      })
    }

    // Complete with COD (system payment)
    const completeRes = await request.post(`${API}/store/carts/${cartId}/complete`, {
      headers: {
        "x-publishable-api-key": pk,
        Authorization: `Bearer ${buyerToken}`,
      },
    })
    expect(completeRes.ok()).toBeTruthy()
    const completed = await completeRes.json()
    const order = completed?.order ?? completed?.cart ?? {}
    expect(order.id || order.order_id).toBeTruthy()
  })

  test("guest checkout — complete purchase without account", async ({ page, request }) => {
    const pk = publishableKey()
    expect(pk).toBeTruthy()

    const catalogRes = await request.get(`${API}/store/alkemart/catalog?limit=3`, {
      headers: { "x-publishable-api-key": pk },
    })
    const catalog = await catalogRes.json()
    const products = catalog?.products ?? []
    test.skip(products.length === 0, "no products")

    const product = products[0]
    const variantId = product.variants?.[0]?.id
    expect(variantId).toBeTruthy()

    // Guest cart
    const cartRes = await request.post(`${API}/store/carts`, {
      headers: { "x-publishable-api-key": pk },
      data: { currency_code: "ghs", region_id: product.region_id },
    })
    const cart = await cartRes.json()
    expect(cart.cart?.id).toBeTruthy()
    const cartId = cart.cart.id

    await request.post(`${API}/store/carts/${cartId}/line-items`, {
      headers: { "x-publishable-api-key": pk },
      data: { variant_id: variantId, quantity: 1 },
    })

    const completeRes = await request.post(`${API}/store/carts/${cartId}/complete`, {
      headers: { "x-publishable-api-key": pk },
    })
    const completed = await completeRes.json()
    const order = completed?.order ?? completed?.cart ?? {}
    expect(order.id || order.order_id).toBeTruthy()
  })
})
