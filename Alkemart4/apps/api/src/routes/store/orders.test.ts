import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"

const JWT = "x".repeat(32)

async function seedBuyer(authRepo: InMemoryAuthRepository) {
  await authRepo.createUser({
    id: "buyer-1",
    email: "buyer@alkemart.test",
    passwordHash: await hashPassword("BuyerPass1"),
    role: "buyer",
  })
}

async function placeCod(app: ReturnType<typeof createApp>, email: string) {
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
    body: JSON.stringify({ cartId, method: "cod", buyerEmail: email, shippingAddress: { first_name: "Ama", last_name: "Mensah", phone: "0244123456", address_1: "12 High St", city: "Accra", country_code: "gh" } }),
  })
  expect(checkout.status).toBe(200)
  return (await checkout.json()) as {
    orderGroupId: string
    orders: Array<{ id: string }>
  }
}

describe("store buyer orders", () => {
  it("lists and retrieves orders for signed-in buyer; lookup by email for guests", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const authRepo = new InMemoryAuthRepository()
    await seedBuyer(authRepo)
    const app = createApp({
      repo: catalog,
      checkoutRepo,
      authRepo,
      jwtSecret: JWT,
    })

    const placed = await placeCod(app, "buyer@alkemart.test")

    const login = await app.request("/store/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "buyer@alkemart.test",
        password: "BuyerPass1",
      }),
    })
    expect(login.status).toBe(200)
    const { token } = (await login.json()) as { token: string }

    const list = await app.request("/store/orders", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(list.status).toBe(200)
    const listBody = (await list.json()) as {
      items: Array<{ id: string; orders: Array<{ items: unknown[] }> }>
    }
    expect(listBody.items).toHaveLength(1)
    expect(listBody.items[0]!.id).toBe(placed.orderGroupId)
    expect(listBody.items[0]!.orders[0]!.items.length).toBeGreaterThan(0)

    const detail = await app.request(`/store/orders/${placed.orderGroupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(detail.status).toBe(200)

    const bySellerOrder = await app.request(
      `/store/orders/${placed.orders[0]!.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(bySellerOrder.status).toBe(200)

    const denied = await app.request(`/store/orders/${placed.orderGroupId}`)
    expect(denied.status).toBe(404)

    const lookup = await app.request("/store/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: placed.orderGroupId,
        email: "buyer@alkemart.test",
      }),
    })
    expect(lookup.status).toBe(200)

    const badLookup = await app.request("/store/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: placed.orderGroupId,
        email: "other@alkemart.test",
      }),
    })
    expect(badLookup.status).toBe(404)
  })

  it("checkout status returns completed after COD", async () => {
    const snapshot = demoCatalog()
    const catalog = new InMemoryCatalogRepository(snapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(snapshot)
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: catalog,
      checkoutRepo,
      jwtSecret: JWT,
    })

    const cartRes = await app.request("/store/cart", { method: "POST" })
    const { cartId } = (await cartRes.json()) as { cartId: string }
    await app.request(`/store/cart/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "offer-a", qty: 1 }),
    })
    await app.request("/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        method: "cod",
        buyerEmail: "guest@alkemart.test",
        shippingAddress: { first_name: "Ama", last_name: "Mensah", phone: "0244123456", address_1: "12 High St", city: "Accra", country_code: "gh" },
      }),
    })

    const status = await app.request(
      `/store/checkout/status?cartId=${encodeURIComponent(cartId)}`,
    )
    expect(status.status).toBe(200)
    const body = (await status.json()) as {
      status: string
      orderGroupId: string | null
    }
    expect(body.status).toBe("completed")
    expect(body.orderGroupId).toBeTruthy()
  })
})
