import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv(): ApiEnv {
  const store = new Map<string, string>()
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {
      get: (async (k: string) => store.get(k) ?? null) as KVNamespace["get"],
      put: (async (k: string, v: string) => { store.set(k, v) }) as KVNamespace["put"],
    } as KVNamespace,
  }
}

function json(method: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method, headers, body: JSON.stringify(body) }
}

async function setup() {
  const snapshot: CatalogSnapshot = {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [
      {
        id: "seller-1",
        handle: "delete-shop",
        name: "Delete Shop",
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
    user: { id: "u1", email: "delete@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "seller-1", handle: "delete-shop", name: "Delete Shop" },
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
    json("POST", { email: "delete@alkemart.test", password: "VendorPass1" }),
    testEnv(),
  )
  expect(vendor.status).toBe(200)
  const vendorBody = (await vendor.json()) as { token: string; user: { sellerId: string } }
  const sellerToken = vendorBody.token
  const sellerId = vendorBody.user.sellerId
  return { app, sellerToken, sellerId }
}

async function createMatrix(app: ReturnType<typeof createApp>, token: string) {
  const res = await app.request(
    "/vendor/products",
    json(
      "POST",
      {
        title: "Doomed Kente",
        primaryCategoryId: "women",
        pricePesewas: "10000",
        onHand: 4,
        variant_options: [{ name: "Size", values: ["S", "M"] }],
      },
      token,
    ),
    testEnv(),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { product: { id: string }; variants: unknown[] }).product.id
}

describe("DELETE /vendor/products/:id", () => {
  it("removes a clean product with every combo and option", async () => {
    const { app, sellerToken } = await setup()
    const productId = await createMatrix(app, sellerToken)
    const del = await app.request(`/vendor/products/${productId}`, { method: "DELETE", headers: { Authorization: `Bearer ${sellerToken}` } }, testEnv())
    expect(del.status).toBe(200)
    const list = await app.request("/vendor/products", { headers: { Authorization: `Bearer ${sellerToken}` } }, testEnv())
    expect(((await list.json()) as { items: unknown[] }).items).toHaveLength(0)
    const again = await app.request(`/vendor/products/${productId}`, { method: "DELETE", headers: { Authorization: `Bearer ${sellerToken}` } }, testEnv())
    expect(again.status).toBe(404)
  })

  it("409s when order history exists; 404s for other sellers", async () => {
    const { app, sellerToken, sellerId } = await setup()
    const productId = await createMatrix(app, sellerToken)

    // Place a COD order through the store so history exists.
    const adminLogin = await app.request(
      "/admin/auth/login",
      json("POST", { email: "admin@alkemart.test", password: "AdminPass1" }),
      testEnv(),
    )
    const adminToken = ((await adminLogin.json()) as { token: string }).token
    await app.request(`/admin/sellers/${sellerId}/approve`, json("POST", {}, adminToken), testEnv())
    await app.request(`/admin/products/${productId}/approve`, json("POST", {}, adminToken), testEnv())
    const cartRes = await app.request("/store/cart", { method: "POST" }, testEnv())
    const { cartId } = (await cartRes.json()) as { cartId: string }
    const catalog = await app.request("/store/catalog?limit=50", {}, testEnv())
    const offerId = ((await catalog.json()) as { items: { bestOfferId: string; productId: string }[] }).items.find(
      (i) => i.productId === productId,
    )!.bestOfferId
    await app.request(`/store/cart/${cartId}/items`, json("POST", { offerId, qty: 1 }), testEnv())
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

    const blocked = await app.request(`/vendor/products/${productId}`, { method: "DELETE", headers: { Authorization: `Bearer ${sellerToken}` } }, testEnv())
    expect(blocked.status).toBe(409)

    // Another seller cannot delete it either.
    const other = await app.request(
      "/vendor/auth/register",
      json("POST", {
        email: "other@alkemart.test",
        password: "VendorPass1",
        sellerName: "Other",
        sellerHandle: "other-shop",
      }),
      testEnv(),
    )
    const otherToken = ((await other.json()) as { token: string }).token
    const foreign = await app.request(`/vendor/products/${productId}`, { method: "DELETE", headers: { Authorization: `Bearer ${otherToken}` } }, testEnv())
    expect(foreign.status).toBe(404)
  })
})
