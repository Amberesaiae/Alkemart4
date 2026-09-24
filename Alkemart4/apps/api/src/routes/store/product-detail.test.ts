import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
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

describe("GET /store/products/:id with variants", () => {
  it("exposes optionTypes, per-offer option maps, and every combo incl. OOS", async () => {
    const snapshot: CatalogSnapshot = {
      categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
      sellers: [
        {
          id: "seller-1",
          handle: "pdp-shop",
          name: "PDP Shop",
          status: "open",
          commissionBps: 700,
          deliveryFeePesewas: 0n,
          availability: "open",
          pausedUntil: null,
          pauseNote: null,
        },
      ],
      products: [],
      variants: [],
      offers: [],
      productOptions: [],
      productOptionValues: [],
      variantOptionValues: [],
    attributeDefinitions: [],
    attributeProfiles: [],
    profileAttributes: [],
    productAttributeValues: [],
    matchCandidates: [],
    searchAliases: [],
    verifications: [],
    priceHistory: [],
    }
    const authRepo = new InMemoryAuthRepository()
    const { hashPassword } = await import("@alkemart/domain")
    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    await authRepo.registerVendor({
      user: { id: "u1", email: "pdp@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
      seller: { id: "seller-1", handle: "pdp-shop", name: "PDP Shop" },
    })
    await authRepo.updateSellerStatus("seller-1", "open")
    const app = createApp({
      authRepo,
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      jwtSecret: JWT_SECRET,
    })
    const vendor = await app.request(
      "/vendor/auth/login",
      json("POST", { email: "pdp@alkemart.test", password: "VendorPass1" }),
      testEnv(),
    )
    expect(vendor.status).toBe(200)
    const sellerToken = ((await vendor.json()) as { token: string }).token
    const created = await app.request(
      "/vendor/products",
      json(
        "POST",
        {
          title: "Ankara Gown",
          primaryCategoryId: "women",
          pricePesewas: "50000",
          onHand: 10,
          variant_options: [
            { name: "Size", values: ["S", "M"] },
            { name: "Colour", values: ["Red"] },
          ],
          variant_entries: [{ options: { Size: "M", Colour: "Red" }, quantity: 0 }],
        },
        sellerToken,
      ),
      testEnv(),
    )
    expect(created.status).toBe(201)
    const productId = ((await created.json()) as { product: { id: string } }).product.id
    const adminLogin = await app.request(
      "/admin/auth/login",
      json("POST", { email: "admin@alkemart.test", password: "AdminPass1" }),
      testEnv(),
    )
    const adminToken = ((await adminLogin.json()) as { token: string }).token
    const sellersRes = await app.request("/admin/sellers", { headers: { Authorization: `Bearer ${adminToken}` } }, testEnv())
    const sellerId = ((await sellersRes.json()) as { items: { id: string }[] }).items[0]!.id
    const approveSeller = await app.request(`/admin/sellers/${sellerId}/approve`, json("POST", {}, adminToken), testEnv())
    expect(approveSeller.status).toBe(200)
    const approveProduct = await app.request(`/admin/products/${productId}/approve`, json("POST", {}, adminToken), testEnv())
    expect(approveProduct.status).toBe(200)

    const res = await app.request(`/store/products/${productId}`, {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      optionTypes: { name: string; values: { value: string; imageUrl: string | null }[] }[]
      combos: {
        offerId: string
        sellerId: string
        options: Record<string, string>
        pricePesewas: string
        availableQty: number
        active: boolean
      }[]
      offers: { offerId: string; options: Record<string, string> }[]
      ratingCount: number
      ratingAvg: number | null
      reviews: unknown[]
    }
    expect(body.optionTypes).toEqual([
      { name: "Size", values: [{ value: "S", imageUrl: null }, { value: "M", imageUrl: null }] },
      { name: "Colour", values: [{ value: "Red", imageUrl: null }] },
    ])
    expect(body.combos).toHaveLength(2)
    // The zero-stock combo is present for honest strikethrough (not sellable).
    expect(body.combos.find((c) => c.options.Size === "M")).toMatchObject({ availableQty: 0, active: true })
    // Peer offers are LISTABLE, not sellable: the zero-stock combo stays
    // visible so the buyer can see the variant exists, with availableQty 0 so
    // the UI badges it and add-to-cart refuses. Hiding it made a marketplace
    // between deliveries look empty.
    expect(body.offers).toHaveLength(2)
    const inStock = body.offers.find((o) => (o as unknown as { available: number }).available > 0)
    const outOfStock = body.offers.find((o) => (o as unknown as { available: number }).available === 0)
    expect(inStock).toMatchObject({ options: { Size: "S", Colour: "Red" } })
    expect(outOfStock).toMatchObject({ options: { Size: "M", Colour: "Red" } })
    expect(body.ratingCount).toBe(0)
    expect(body.ratingAvg).toBeNull()
    expect(body.reviews).toEqual([])

    // A delivered order → verified review → published → visible in detail.
    const cartRes = await app.request("/store/cart", { method: "POST" }, testEnv())
    const { cartId } = (await cartRes.json()) as { cartId: string }
    await app.request(
      `/store/cart/${cartId}/items`,
      json("POST", { offerId: body.offers[0]!.offerId, qty: 1 }),
      testEnv(),
    )
    await app.request(
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
    const mineRes = await app.request(
      "/vendor/orders",
      { headers: { Authorization: `Bearer ${sellerToken}` } },
      testEnv(),
    )
    const orderId = ((await mineRes.json()) as { items: { id: string }[] }).items[0]!.id
    for (const next of ["ship", "deliver"]) {
      await app.request(`/vendor/orders/${orderId}/${next}`, json("POST", {}, sellerToken), testEnv())
    }
    await app.request(
      "/store/reviews",
      json("POST", { orderId, buyerEmail: "buyer@alkemart.test", rating: 5, title: "Fits well", body: "True to size." }),
      testEnv(),
    )
    const pending = await app.request(
      "/admin/reviews",
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv(),
    )
    const reviewId = ((await pending.json()) as { reviews: { id: string }[] }).reviews[0]!.id
    await app.request(`/admin/reviews/${reviewId}/moderate`, json("POST", { action: "publish" }, adminToken), testEnv())

    const again = await app.request(`/store/products/${productId}`, {}, testEnv())
    const detail = (await again.json()) as {
      ratingAvg: number
      ratingCount: number
      reviews: { rating: number; title: string; body: string; vendorResponse: null }[]
    }
    expect(detail.ratingCount).toBe(1)
    expect(detail.ratingAvg).toBe(5)
    expect(detail.reviews[0]).toMatchObject({ rating: 5, title: "Fits well" })
  })
})
