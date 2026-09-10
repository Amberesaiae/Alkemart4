import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { InMemoryTrafficStore } from "../../traffic"

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

function catalogWithProduct(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [
      { id: "seller-1", handle: "ama-shop", name: "Ama Shop", status: "open", commissionBps: 700, deliveryFeePesewas: 0n, availability: "open", pausedUntil: null, pauseNote: null },
    ],
    products: [
      {
        id: "p-1", title: "Kente", description: null, status: "published",
        primaryCategoryId: "phones", sellerId: "seller-1", imageUrl: null,
      },
    ],
    variants: [{ id: "v-1", productId: "p-1", sku: null, title: "Default" }],
    offers: [
      { id: "o-1", sellerId: "seller-1", productId: "p-1", variantId: "v-1", pricePesewas: 25000n, onHand: 5, reserved: 0, currency: "ghs", active: true },
    ],
  }
}

async function sellerToken(app: ReturnType<typeof createApp>) {
  const res = await app.request(
    "/vendor/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "traffic@alkemart.test",
        password: "VendorPass1",
        sellerName: "Traffic Shop",
        sellerHandle: "traffic-shop",
      }),
    },
    testEnv(),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { token: string; user: { sellerId: string } }).token
}

describe("shop traffic", () => {
  it("records product + shop views on store reads and aggregates per seller", async () => {
    const snapshot = catalogWithProduct()
    const traffic = new InMemoryTrafficStore()
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      trafficStore: traffic,
      jwtSecret: JWT_SECRET,
    })

    // Two product views + one shop view (seller-1 owns p-1).
    await app.request("/store/products/p-1", {}, testEnv())
    await app.request("/store/products/p-1", {}, testEnv())
    const shop = await app.request("/store/sellers/ama-shop", {}, testEnv())
    expect(shop.status).toBe(200)

    const token = await sellerToken(app)
    // traffic-shop seller has no views; switch token to seller-1's owner? No:
    // assert via direct store instead (seller-1 has no login here).
    const stats = await traffic.shopStats("seller-1")
    expect(stats.series.reduce((s, d) => s + d.views, 0)).toBe(3)
    expect(stats.top).toEqual([{ productId: "p-1", views: 2 }])
    expect(token.length).toBeGreaterThan(10)
  })

  it("GET /vendor/stats/shop returns views, conversion, and top products", async () => {
    const snapshot = catalogWithProduct()
    const traffic = new InMemoryTrafficStore()
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      trafficStore: traffic,
      jwtSecret: JWT_SECRET,
    })
    const reg = await app.request(
      "/vendor/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "stats-shop@alkemart.test",
          password: "VendorPass1",
          sellerName: "Stats Shop",
          sellerHandle: "stats-shop",
        }),
      },
      testEnv(),
    )
    const { token, user } = (await reg.json()) as { token: string; user: { sellerId: string } }
    await traffic.recordView(user.sellerId, "p-1", new Date())
    await traffic.recordView(user.sellerId, "p-1", new Date())
    await traffic.recordView(user.sellerId, null, new Date())

    const res = await app.request(
      "/vendor/stats/shop",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      views30d: number
      conversion: number
      top: { productId: string; title: string; views: number }[]
    }
    expect(body.views30d).toBe(3)
    expect(body.conversion).toBe(0)
    expect(body.top).toEqual([{ productId: "p-1", title: "p-1", thumbnail: null, views: 2 }])
  })
})
