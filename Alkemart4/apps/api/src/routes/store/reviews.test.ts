import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { demoCatalog } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { verifiedBuyerFixture } from "../../lib/verified-buyer-fixture"
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

let buyerToken: string
function json(method: string, body: unknown, token: string = buyerToken) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method, headers, body: JSON.stringify(body) }
}

async function setup() {
  const snapshot = demoCatalog()
  const authRepo = new InMemoryAuthRepository()
  buyerToken = await verifiedBuyerFixture(authRepo, JWT_SECRET)
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
  await authRepo.markEmailVerified("u1")
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

/** A delivered COD order for buyer@alkemart.test, through the real routes. */
async function deliveredOrder(app: Awaited<ReturnType<typeof setup>>["app"], sellerToken: string) {
  const { cartId } = (await (await app.request("/store/cart", { method: "POST" }, testEnv())).json()) as { cartId: string }
  await app.request(`/store/cart/${cartId}/items`, json("POST", { offerId: "offer-a", qty: 1 }), testEnv())
  const cod = await app.request(
    "/store/checkout",
    json("POST", {
      cartId,
      method: "cod",
      buyerEmail: "buyer@alkemart.test",
      shippingAddress: { first_name: "Ama", last_name: "Mensah", phone: "0244123456", address_1: "12 High St", city: "Accra", country_code: "gh" },
    }),
    testEnv(),
  )
  expect(cod.status).toBe(200)
  const orderId = ((await cod.json()) as { orders: { id: string }[] }).orders[0]!.id
  for (const next of ["ship", "deliver"]) {
    const flip = await app.request(`/vendor/orders/${orderId}/${next}`, json("POST", next === "deliver" ? { code: await buyerCode(app, orderId) } : {}, sellerToken), testEnv())
    expect(flip.status).toBe(200)
  }
  return orderId
}

describe("buyer → vendor → moderation review loop", () => {
  it("a clean verified review is live at once; admin can still take it down", async () => {
    const { app, sellerToken, adminToken } = await setup()
    const admin = { headers: { Authorization: `Bearer ${adminToken}` } }
    const orderId = await deliveredOrder(app, sellerToken)

    const write = await app.request(
      "/store/reviews",
      json("POST", { orderId, buyerEmail: "buyer@alkemart.test", rating: 5, title: "Solid", body: "Works great, fast delivery. Paid with MoMo." }),
      testEnv(),
    )
    expect(write.status).toBe(201)
    const review = ((await write.json()) as { review: { id: string; status: string } }).review
    // "MoMo" alone is how buyers pay — not a reason to hold a review.
    expect(review.status).toBe("published")

    const dup = await app.request("/store/reviews", json("POST", { orderId, buyerEmail: "buyer@alkemart.test", rating: 4, body: "Again." }), testEnv())
    expect(dup.status).toBe(409)
    const wrongEmail = await app.request("/store/reviews", json("POST", { orderId, buyerEmail: "stranger@alkemart.test", rating: 1, body: "Hijack." }), testEnv())
    expect(wrongEmail.status).toBe(403)

    const vendorInbox = await app.request("/vendor/reviews/mine", { headers: { Authorization: `Bearer ${sellerToken}` } }, testEnv())
    expect(((await vendorInbox.json()) as { reviews: unknown[] }).reviews).toHaveLength(1)
    const respond = await app.request(`/vendor/reviews/${review.id}/respond`, json("POST", { message: "Thanks Ama — enjoy!" }, sellerToken), testEnv())
    expect(respond.status).toBe(200)
    expect(((await respond.json()) as { review: { vendorResponse: string } }).review.vendorResponse).toBe("Thanks Ama — enjoy!")

    // Nothing waits for admin; it's in the Live list, and admin can hide it.
    expect(((await (await app.request("/admin/reviews", admin, testEnv())).json()) as { reviews: unknown[] }).reviews).toHaveLength(0)
    const live = (await (await app.request("/admin/reviews?view=live", admin, testEnv())).json()) as { reviews: { id: string }[] }
    expect(live.reviews.map((r) => r.id)).toEqual([review.id])
    expect((await app.request(`/admin/reviews/${review.id}/moderate`, json("POST", { action: "hide" }, adminToken), testEnv())).status).toBe(200)
    expect(((await (await app.request("/admin/reviews?view=live", admin, testEnv())).json()) as { reviews: unknown[] }).reviews).toHaveLength(0)
  })

  it("a review with contact details or a link waits for a person", async () => {
    const { app, sellerToken, adminToken } = await setup()
    const admin = { headers: { Authorization: `Bearer ${adminToken}` } }
    const orderId = await deliveredOrder(app, sellerToken)
    const write = await app.request(
      "/store/reviews",
      json("POST", { orderId, buyerEmail: "buyer@alkemart.test", rating: 5, body: "Great! WhatsApp me on 0244 123 456 for cheaper ones." }),
      testEnv(),
    )
    const review = ((await write.json()) as { review: { id: string; status: string } }).review
    expect(review.status).toBe("pending")
    const waiting = (await (await app.request("/admin/reviews", admin, testEnv())).json()) as { reviews: { id: string }[] }
    expect(waiting.reviews.map((r) => r.id)).toEqual([review.id])
    expect((await app.request(`/admin/reviews/${review.id}/moderate`, json("POST", { action: "publish" }, adminToken), testEnv())).status).toBe(200)
    expect(((await (await app.request("/admin/reviews", admin, testEnv())).json()) as { reviews: unknown[] }).reviews).toHaveLength(0)
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

/** The buyer's handover code, read the way the buyer reads it (order lookup). */
async function buyerCode(app: { request: (...a: never[]) => Response | Promise<Response> }, orderId: string, email = "buyer@alkemart.test") {
  const res = await (app.request as unknown as (p: string, i: RequestInit, e?: unknown) => Promise<Response>)(
    "/store/orders/lookup",
    { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${buyerToken}` }, body: JSON.stringify({ orderId, email }) },
    testEnv(),
  )
  const body = (await res.json()) as { orderGroup: { orders: { id: string; handoverCode: string | null }[] } }
  return body.orderGroup.orders.find((o) => o.id === orderId)?.handoverCode ?? ""
}
