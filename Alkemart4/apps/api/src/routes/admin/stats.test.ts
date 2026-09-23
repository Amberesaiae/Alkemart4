import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryTrafficStore } from "../../traffic"
import type { CatalogRepository } from "../../catalog-repository"
import type { CheckoutRepository } from "../../checkout-repository"
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

async function adminToken(app: ReturnType<typeof createApp>) {
  const login = await app.request("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
  })
  expect(login.status).toBe(200)
  return ((await login.json()) as { token: string }).token
}

describe("GET /admin/stats", () => {
  it("aggregates totals, a 30-day series, and top products", async () => {
    const authRepo = new InMemoryAuthRepository()
    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    const now = Date.now()
    const day = 86_400_000
    const checkoutRepo = {
      platformOrderStats: async () => ({
        groups: [
          { totalPesewas: 10000n, createdAt: new Date(now - 2 * day) },
          { totalPesewas: 2500n, createdAt: new Date(now - 40 * day) },
        ],
        topItems: [{ productId: "p1", title: "Kente", units: 3, gmvPesewas: 9000n }],
      }),
    } as unknown as CheckoutRepository
    const catalogRepo = {
      listAdminProducts: async () => [
        { id: "p1", title: "Kente", imageUrl: "http://x/kente.webp" },
        { id: "p2", title: "Shea", imageUrl: null },
      ],
    } as unknown as CatalogRepository
    const app = createApp({ authRepo, jwtSecret: JWT_SECRET, checkoutRepo, repo: catalogRepo })
    const token = await adminToken(app)

    const res = await app.request(
      "/admin/stats",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      total_orders: number
      total_gmv_ghs: number
      active_sellers: number
      catalog_size: number
      gmv_last_30_days: { date: string; amount: number }[]
      top_products: { title: string; thumbnail: string | null; units: number; gmv: number }[]
    }
    expect(body.total_orders).toBe(2)
    expect(body.total_gmv_ghs).toBe(125)
    expect(body.active_sellers).toBe(0)
    expect(body.catalog_size).toBe(2)
    expect(body.gmv_last_30_days).toHaveLength(30)
    const seriesTotal = body.gmv_last_30_days.reduce((s, d) => s + d.amount, 0)
    expect(seriesTotal).toBe(100)
    expect(body.top_products).toEqual([
      { title: "Kente", thumbnail: "http://x/kente.webp", units: 3, gmv: 90 },
    ])
  })

  it("401s without an admin session", async () => {
    const app = createApp({ authRepo: new InMemoryAuthRepository(), jwtSecret: JWT_SECRET })
    const res = await app.request("/admin/stats", {}, testEnv())
    expect(res.status).toBe(401)
  })
})

describe("GET /admin/stats/traffic", () => {
  it("returns the 30-day view series and top shops with names", async () => {
    const authRepo = new InMemoryAuthRepository()
    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    await authRepo.registerVendor({
      user: { id: "u1", email: "s@alkemart.test", passwordHash: await hashPassword("VendorPass1") },
      seller: { id: "seller-1", handle: "ama-shop", name: "Ama Shop" },
    })
    const trafficStore = new InMemoryTrafficStore()
    const today = new Date()
    for (let i = 0; i < 5; i++) await trafficStore.recordView("seller-1", null, today)
    await trafficStore.recordView("seller-1", "p-1", today)
    await trafficStore.recordView("ghost-seller", null, today)
    const app = createApp({ authRepo, trafficStore, jwtSecret: JWT_SECRET })
    const token = await adminToken(app)
    const res = await app.request(
      "/admin/stats/traffic",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      views30d: number
      series: { date: string; views: number }[]
      top_shops: { sellerId: string; name: string; handle: string | null; views: number }[]
    }
    expect(body.views30d).toBe(7)
    expect(body.series).toHaveLength(30)
    expect(body.series[29]!.views).toBe(7)
    expect(body.top_shops[0]).toEqual({ sellerId: "seller-1", name: "Ama Shop", handle: "ama-shop", views: 6 })
    expect(body.top_shops[1]).toEqual({ sellerId: "ghost-seller", name: "ghost-seller", handle: null, views: 1 })
  })
})
