import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog, type CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars-long",
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function emptyCatalog(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [],
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
}

/**
 * Phase 6C — the sitemap exposes indexable truth only: sellable products,
 * browsable categories, open shops, live non-empty shelves. Drafts and
 * empty shelves never appear; paused shops stay listed because their pages
 * state the pause honestly (same rule as the PDP).
 */
describe("GET /store/sitemap (Phase 6C)", () => {
  it("lists sellable products, leaf categories, and open shops", async () => {
    const snapshot = demoCatalog()
    const app = createApp({
      repo: new InMemoryCatalogRepository(snapshot),
      authRepo: new InMemoryAuthRepository(),
      jwtSecret: "test-jwt-secret-that-is-at-least-32-chars-long",
    })
    const res = await app.request("/store/sitemap", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { urls: { path: string; type: string }[]; count: number }
    const paths = body.urls.map((u) => u.path)
    expect(paths).toContain("/product/prod-tecno-spark")
    expect(paths).toContain("/categories/phones")
    expect(paths).toContain("/shops/seller-a")
    expect(body.count).toBe(body.urls.length)
  })

  it("hides drafts and empty shelves (paused shops stay listed with their honest paused state)", async () => {
    const repo = new InMemoryCatalogRepository(emptyCatalog())
    const authRepo = new InMemoryAuthRepository()
    const app = createApp({ repo, authRepo, jwtSecret: "test-jwt-secret-that-is-at-least-32-chars-long" })
    const json = (method: string, body: unknown, token?: string) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers.Authorization = `Bearer ${token}`
      return { method, headers, body: JSON.stringify(body) }
    }
    const register = async (email: string, handle: string) => {
      await app.request(
        "/vendor/auth/register",
        json("POST", { email, password: "VendorPass1", sellerName: `${handle} Shop`, sellerHandle: handle }),
        testEnv(),
      )
      const login = await app.request(
        "/vendor/auth/login",
        json("POST", { email, password: "VendorPass1" }),
        testEnv(),
      )
      return ((await login.json()) as { token: string }).token
    }
    const token = await register("sm@alkemart.test", "sm-shop")
    // Draft product: created but never approved.
    await app.request(
      "/vendor/products",
      json("POST", { title: "Draft Item", primaryCategoryId: "phones", pricePesewas: "1000", onHand: 1 }, token),
      testEnv(),
    )
    // Paused shop: seller row mirrored into the catalog, then paused.
    const snap = repo.snapshot()
    const sellerId = snap.products[0]!.sellerId as string
    snap.sellers.push({
      id: sellerId,
      handle: "sm-shop",
      name: "sm-shop Shop",
      status: "open",
      commissionBps: 700,
      deliveryFeePesewas: 0n,
      availability: "paused",
      pausedUntil: null,
      pauseNote: "restocking",
    })
    const before = (await (await app.request("/store/sitemap", {}, testEnv())).json()) as {
      urls: { path: string }[]
    }
    expect(before.urls.map((u) => u.path)).not.toContain("/product/" + snap.products[0]!.id)

    // Live shelf appears; empty shelves never do.
    const created = await app.request("/vendor/collections", json("POST", { name: "Shelf" }, token), testEnv())
    const shelfId = ((await created.json()) as { item: { id: string } }).item.id
    const productId = snap.products[0]!.id
    await app.request(
      `/vendor/collections/${shelfId}/products`,
      json("PUT", { productIds: [productId] }, token),
      testEnv(),
    )
    await app.request(
      `/vendor/collections/${shelfId}`,
      json("PATCH", { visibility: "published" }, token),
      testEnv(),
    )
    const after = (await (await app.request("/store/sitemap", {}, testEnv())).json()) as {
      urls: { path: string; type: string }[]
    }
    const shelfPaths = after.urls.filter((u) => u.type === "collection").map((u) => u.path)
    expect(shelfPaths).toHaveLength(1)
    expect(shelfPaths[0]).toContain(`/shops/collections/${shelfId}`)
  })
})
