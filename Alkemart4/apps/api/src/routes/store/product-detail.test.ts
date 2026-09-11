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
      optionTypes: { name: string; values: string[] }[]
      combos: {
        offerId: string
        sellerId: string
        options: Record<string, string>
        pricePesewas: string
        availableQty: number
        active: boolean
      }[]
      offers: { offerId: string; options: Record<string, string> }[]
    }
    expect(body.optionTypes).toEqual([
      { name: "Size", values: ["S", "M"] },
      { name: "Colour", values: ["Red"] },
    ])
    expect(body.combos).toHaveLength(2)
    // The zero-stock combo is present for honest strikethrough (not sellable).
    expect(body.combos.find((c) => c.options.Size === "M")).toMatchObject({ availableQty: 0, active: true })
    // Sellable peer offers carry their option maps.
    expect(body.offers).toHaveLength(1)
    expect(body.offers[0]).toMatchObject({ options: { Size: "S", Colour: "Red" } })
  })
})
