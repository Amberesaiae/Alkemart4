import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
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

function json(method: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method, headers, body: JSON.stringify(body) }
}

async function setup() {
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const repo = new InMemoryCatalogRepository(emptyCatalog())
  const app = createApp({ authRepo, repo, jwtSecret: JWT_SECRET })
  const adminLogin = await app.request(
    "/admin/auth/login",
    json("POST", { email: "admin@alkemart.test", password: "AdminPass1" }),
    testEnv(),
  )
  const adminToken = ((await adminLogin.json()) as { token: string }).token
  const register = async (email: string, handle: string) => {
    const res = await app.request(
      "/vendor/auth/register",
      json("POST", { email, password: "VendorPass1", sellerName: `${handle} Shop`, sellerHandle: handle }),
      testEnv(),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { token: string; user: { sellerId: string } }
    const login = await app.request(
      "/vendor/auth/login",
      json("POST", { email, password: "VendorPass1" }),
      testEnv(),
    )
    return { token: ((await login.json()) as { token: string }).token, sellerId: body.user.sellerId }
  }
  const a = await register("a@alkemart.test", "shop-a")
  const b = await register("b@alkemart.test", "shop-b")
  const createProduct = async (token: string, title: string, category: string) => {
    const res = await app.request(
      "/vendor/products",
      json("POST", { title, primaryCategoryId: category, pricePesewas: "10000", onHand: 3 }, token),
      testEnv(),
    )
    expect(res.status).toBe(201)
    return ((await res.json()) as { product: { id: string } }).product.id
  }
  const phoneId = await createProduct(a.token, "Tecno Spark", "phones")
  const gownId = await createProduct(a.token, "Ankara Gown", "women")
  const otherId = await createProduct(b.token, "B Shop Phone", "phones")
  return { app, repo, adminToken, a, b, phoneId, gownId, otherId }
}

describe("vendor collections (Phase 4A)", () => {
  it("creates with auto-slug, reads, renames, and deletes", async () => {
    const { app, a } = await setup()
    const created = await app.request(
      "/vendor/collections",
      json("POST", { name: "New Arrivals" }, a.token),
      testEnv(),
    )
    expect(created.status).toBe(201)
    const item = ((await created.json()) as { item: { id: string; slug: string; visibility: string } }).item
    expect(item.slug).toBe("new-arrivals")

    const again = await app.request(
      "/vendor/collections",
      json("POST", { name: "New Arrivals" }, a.token),
      testEnv(),
    )
    expect(((await again.json()) as { item: { slug: string } }).item.slug).toBe("new-arrivals-2")

    const clash = await app.request(
      "/vendor/collections",
      json("POST", { name: "Other", slug: "new-arrivals" }, a.token),
      testEnv(),
    )
    expect(clash.status).toBe(409)

    const patched = await app.request(
      `/vendor/collections/${item.id}`,
      json("PATCH", { visibility: "published", description: "Fresh drops" }, a.token),
      testEnv(),
    )
    expect(patched.status).toBe(200)
    expect(((await patched.json()) as { item: { visibility: string } }).item.visibility).toBe("published")

    const listed = await app.request("/vendor/collections", { headers: { Authorization: `Bearer ${a.token}` } }, testEnv())
    expect(((await listed.json()) as { items: unknown[] }).items).toHaveLength(2)

    const deleted = await app.request(
      `/vendor/collections/${item.id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${a.token}` } },
      testEnv(),
    )
    expect(deleted.status).toBe(200)
    const missing = await app.request(
      `/vendor/collections/${item.id}`,
      { headers: { Authorization: `Bearer ${a.token}` } },
      testEnv(),
    )
    expect(missing.status).toBe(404)
  })

  it("holds cross-category members without touching classification", async () => {
    const { app, repo, a, phoneId, gownId } = await setup()
    const created = await app.request(
      "/vendor/collections",
      json("POST", { name: "Mixed Shelf", visibility: "published" }, a.token),
      testEnv(),
    )
    const id = ((await created.json()) as { item: { id: string } }).item.id
    // Order is rank: gown first, phone second.
    const set = await app.request(
      `/vendor/collections/${id}/products`,
      json("PUT", { productIds: [gownId, phoneId] }, a.token),
      testEnv(),
    )
    expect(set.status).toBe(200)
    expect(((await set.json()) as { item: { productIds: string[] } }).item.productIds).toEqual([gownId, phoneId])

    const snap = repo.snapshot()
    expect(snap.products.find((p) => p.id === phoneId)?.primaryCategoryId).toBe("phones")
    expect(snap.products.find((p) => p.id === gownId)?.primaryCategoryId).toBe("women")

    const dupes = await app.request(
      `/vendor/collections/${id}/products`,
      json("PUT", { productIds: [phoneId, phoneId] }, a.token),
      testEnv(),
    )
    expect(dupes.status).toBe(400)
    const tooMany = await app.request(
      `/vendor/collections/${id}/products`,
      json("PUT", { productIds: Array.from({ length: 31 }, (_, i) => `p${i}`) }, a.token),
      testEnv(),
    )
    expect(tooMany.status).toBe(400)
  })

  it("isolates sellers from each other's shelves and products", async () => {
    const { app, a, b, phoneId, otherId } = await setup()
    const created = await app.request(
      "/vendor/collections",
      json("POST", { name: "A Shelf" }, a.token),
      testEnv(),
    )
    const id = ((await created.json()) as { item: { id: string } }).item.id

    for (const [method, path, body] of [
      ["GET", `/vendor/collections/${id}`, undefined],
      ["PATCH", `/vendor/collections/${id}`, { name: "Hijacked" }],
      ["DELETE", `/vendor/collections/${id}`, undefined],
      ["PUT", `/vendor/collections/${id}/products`, { productIds: [otherId] }],
    ] as const) {
      const res = await app.request(
        path,
        body === undefined
          ? { method, headers: { Authorization: `Bearer ${b.token}` } }
          : json(method, body, b.token),
        testEnv(),
      )
      expect(res.status).toBe(404)
    }
    // Seller B cannot shelve seller A's product either.
    const bShelf = await app.request(
      "/vendor/collections",
      json("POST", { name: "B Shelf" }, b.token),
      testEnv(),
    )
    const bId = ((await bShelf.json()) as { item: { id: string } }).item.id
    const foreign = await app.request(
      `/vendor/collections/${bId}/products`,
      json("PUT", { productIds: [phoneId] }, b.token),
      testEnv(),
    )
    expect(foreign.status).toBe(400)
    const own = await app.request(
      `/vendor/collections/${bId}/products`,
      json("PUT", { productIds: [otherId] }, b.token),
      testEnv(),
    )
    expect(own.status).toBe(200)
  })

  it("gates the store read on visibility and schedule", async () => {
    const { app, repo, adminToken, a, phoneId } = await setup()
    // Vendor registration lives in the auth repo; the catalog needs the
    // seller row for sellable-offer math.
    repo.snapshot().sellers.push({
      id: a.sellerId,
      handle: "shop-a",
      name: "shop-a Shop",
      status: "open",
      commissionBps: 700,
      deliveryFeePesewas: 0n,
      availability: "open",
      pausedUntil: null,
      pauseNote: null,
    })
    const mk = async (name: string, patch: Record<string, unknown>) => {
      const created = await app.request("/vendor/collections", json("POST", { name }, a.token), testEnv())
      const id = ((await created.json()) as { item: { id: string } }).item.id
      await app.request(`/vendor/collections/${id}`, json("PATCH", patch, a.token), testEnv())
      await app.request(`/vendor/collections/${id}/products`, json("PUT", { productIds: [phoneId] }, a.token), testEnv())
      return id
    }
    const liveId = await mk("Live", { visibility: "published" })
    const draftId = await mk("Draft", {})
    const futureId = await mk("Future", {
      visibility: "published",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    })
    const expiredId = await mk("Expired", {
      visibility: "published",
      startsAt: new Date(Date.now() - 172_800_000).toISOString(),
      endsAt: new Date(Date.now() - 86_400_000).toISOString(),
    })
    const badWindow = await app.request(
      "/vendor/collections",
      json("POST", { name: "Bad" }, a.token),
      testEnv(),
    )
    const badId = ((await badWindow.json()) as { item: { id: string } }).item.id
    const badPatch = await app.request(
      `/vendor/collections/${badId}`,
      json(
        "PATCH",
        {
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          endsAt: new Date(Date.now() - 86_400_000).toISOString(),
        },
        a.token,
      ),
      testEnv(),
    )
    expect(badPatch.status).toBe(400)

    // Approve so the member product renders a card.
    const sellersRes = await app.request(
      "/admin/sellers",
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv(),
    )
    const sellerId = ((await sellersRes.json()) as { items: { id: string; handle: string }[] }).items.find(
      (s) => s.handle === "shop-a",
    )!.id
    await app.request(`/admin/sellers/${sellerId}/approve`, json("POST", {}, adminToken), testEnv())
    const adminProducts = await app.request(
      "/admin/products",
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv(),
    )
    const prodId = ((await adminProducts.json()) as { items: { id: string; title: string }[] }).items.find(
      (p) => p.title === "Tecno Spark",
    )!.id
    await app.request(`/admin/products/${prodId}/approve`, json("POST", {}, adminToken), testEnv())

    const list = await app.request(`/store/collections?seller_id=${sellerId}`, {}, testEnv())
    expect(list.status).toBe(200)
    const items = ((await list.json()) as { items: { collection: { id: string }; cards: { productId: string }[] }[] }).items
    expect(items.map((i) => i.collection.id)).toEqual([liveId])
    expect(items[0]!.cards.map((c) => c.productId)).toContain(phoneId)

    for (const hidden of [draftId, futureId, expiredId]) {
      const res = await app.request(`/store/collections/${hidden}?seller_id=${sellerId}`, {}, testEnv())
      expect(res.status).toBe(404)
    }
    const shown = await app.request(`/store/collections/${liveId}?seller_id=${sellerId}`, {}, testEnv())
    expect(shown.status).toBe(200)
    const noSeller = await app.request("/store/collections", {}, testEnv())
    expect(noSeller.status).toBe(400)
  })
})
