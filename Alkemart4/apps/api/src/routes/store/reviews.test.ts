import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function json(method: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method, headers, body: JSON.stringify(body) }
}

async function setup() {
  const snapshot = demoCatalog()
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  await authRepo.registerVendor({
    user: { id: "u1", email: "seller@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-a", handle: "seller-a", name: "Seller A" },
  })
  await authRepo.updateSellerStatus("seller-a", "open")
  const app = createApp({
    authRepo,
    repo: new InMemoryCatalogRepository(snapshot),
    checkoutRepo: new InMemoryCheckoutRepository(snapshot),
    jwtSecret: JWT_SECRET,
  })
  const vendorLogin = await app.request(
    "/vendor/auth/login",
    json("POST", { email: "seller@alkemart.test", password: "VendorPass1" }),
    testEnv(),
  )
  expect(vendorLogin.status).toBe(200)
  const sellerToken = ((await vendorLogin.json()) as { token: string }).token

  const adminLogin = await app.request(
    "/admin/auth/login",
    json("POST", { email: "admin@alkemart.test", password: "AdminPass1" }),
    testEnv(),
  )
  const adminToken = ((await adminLogin.json()) as { token: string }).token
  return { app, sellerToken, adminToken }
}

describe("buyer → vendor → moderation review loop", () => {
  it("writes, responds, publishes; guards hold", async () => {
    const { app, sellerToken, adminToken } = await setup()
    // Seed the app's checkoutRepo with a delivered order via the store COD path.
    const cartRes = await app.request("/store/cart", { method: "POST" }, testEnv())
    const { cartId } = (await cartRes.json()) as { cartId: string }
    await app.request(
      `/store/cart/${cartId}/items`,
      json("POST", { offerId: "offer-a", qty: 1 }),
      testEnv(),
    )
    const cod = await app.request(
      "/store/checkout",
      json("POST", {
        cartId,
        method: "cod",
        buyerEmail: "buyer@alkemart.test",
        shippingAddress: {
          first_name: "Ama",
          last_name: "Mensah",
          phone: "0244123456",
          address_1: "12 High St",
          city: "Accra",
          country_code: "gh",
        },
      }),
      testEnv(),
    )
    expect(cod.status).toBe(200)
    expect(cod.status).toBe(200)
    // Flip the app-repo order to delivered through the vendor API.
    const mineRes = await app.request(
      "/vendor/orders",
      { headers: { Authorization: `Bearer ${sellerToken}` } },
      testEnv(),
    )
    const mine = (await mineRes.json()) as { items: { id: string }[] }
    expect(mine.items.length).toBeGreaterThan(0)
    const orderId = mine.items[0]!.id

    for (const next of ["ship", "deliver"]) {
      const flip = await app.request(`/vendor/orders/${orderId}/${next}`, json("POST", {}, sellerToken), testEnv())
      expect(flip.status).toBe(200)
    }

    const write = await app.request(
      "/store/reviews",
      json("POST", { orderId, buyerEmail: "buyer@alkemart.test", rating: 5, title: "Solid", body: "Works great, fast delivery." }),
      testEnv(),
    )
    expect(write.status).toBe(201)
    const reviewId = ((await write.json()) as { review: { id: string; status: string } }).review.id

    const dup = await app.request(
      "/store/reviews",
      json("POST", { orderId, buyerEmail: "buyer@alkemart.test", rating: 4, body: "Again." }),
      testEnv(),
    )
    expect(dup.status).toBe(409)

    const wrongEmail = await app.request(
      "/store/reviews",
      json("POST", { orderId, buyerEmail: "stranger@alkemart.test", rating: 1, body: "Hijack." }),
      testEnv(),
    )
    expect(wrongEmail.status).toBe(403)

    const vendorInbox = await app.request(
      "/vendor/reviews/mine",
      { headers: { Authorization: `Bearer ${sellerToken}` } },
      testEnv(),
    )
    expect(((await vendorInbox.json()) as { reviews: unknown[] }).reviews).toHaveLength(1)

    const respond = await app.request(
      `/vendor/reviews/${reviewId}/respond`,
      json("POST", { message: "Thanks Ama — enjoy!" }, sellerToken),
      testEnv(),
    )
    expect(respond.status).toBe(200)
    expect(((await respond.json()) as { review: { vendorResponse: string } }).review.vendorResponse).toBe(
      "Thanks Ama — enjoy!",
    )

    const adminInbox = await app.request(
      "/admin/reviews",
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv(),
    )
    expect(((await adminInbox.json()) as { reviews: unknown[] }).reviews).toHaveLength(1)

    const publish = await app.request(
      `/admin/reviews/${reviewId}/moderate`,
      json("POST", { action: "publish" }, adminToken),
      testEnv(),
    )
    expect(publish.status).toBe(200)

    const empty = await app.request(
      "/admin/reviews",
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv(),
    )
    expect(((await empty.json()) as { reviews: unknown[] }).reviews).toHaveLength(0)
  })

  it("rejects reviews for undelivered orders", async () => {
    const { app } = await setup()
    const cartRes = await app.request("/store/cart", { method: "POST" }, testEnv())
    expect(cartRes.status).toBe(201)
    const { cartId } = (await cartRes.json()) as { cartId: string }
    const addRes = await app.request(`/store/cart/${cartId}/items`, json("POST", { offerId: "offer-a", qty: 1 }), testEnv())
    expect(addRes.status).toBe(201)
    const codRes = await app.request(
      "/store/checkout",
      json("POST", {
        cartId,
        method: "cod",
        buyerEmail: "buyer@alkemart.test",
        shippingAddress: {
          first_name: "Ama",
          last_name: "Mensah",
          phone: "0244123456",
          address_1: "12 High St",
          city: "Accra",
          country_code: "gh",
        },
      }),
      testEnv(),
    )
    expect(codRes.status).toBe(200)
    // Find the placed (not delivered) order via the vendor list.
    const vendorLogin = await app.request(
      "/vendor/auth/login",
      json("POST", { email: "seller@alkemart.test", password: "VendorPass1" }),
      testEnv(),
    )
    expect(vendorLogin.status).toBe(200)
    const sellerToken = ((await vendorLogin.json()) as { token: string }).token
    const mineRes = await app.request(
      "/vendor/orders",
      { headers: { Authorization: `Bearer ${sellerToken}` } },
      testEnv(),
    )
    const mine = (await mineRes.json()) as { items: { id: string }[] }
    const write = await app.request(
      "/store/reviews",
      json("POST", { orderId: mine.items[0]!.id, buyerEmail: "buyer@alkemart.test", rating: 5, body: "Too early." }),
      testEnv(),
    )
    expect(write.status).toBe(400)
  })
})
