import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: JWT,
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

async function setup() {
  const authRepo = new InMemoryAuthRepository()
  const repo = new InMemoryCatalogRepository(emptyCatalog())
  const checkoutRepo = new InMemoryCheckoutRepository(repo.snapshot())
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  await authRepo.createUser({
    id: "buyer-1",
    email: "buyer@alkemart.test",
    passwordHash: await hashPassword("BuyerPass1"),
    role: "buyer",
  })
  const app = createApp({ authRepo, repo, checkoutRepo, jwtSecret: JWT })
  const json = (method: string, body: unknown, token?: string) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`
    return { method, headers, body: JSON.stringify(body) }
  }
  const adminToken = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)
  const buyerToken = await signSessionJwt({ userId: "buyer-1", role: "buyer" }, JWT)
  const register = async (email: string, handle: string) => {
    const res = await app.request(
      "/vendor/auth/register",
      json("POST", { email, password: "VendorPass1", sellerName: `${handle} Shop`, sellerHandle: handle }),
      testEnv(),
    )
    expect(res.status).toBe(201)
    const login = await app.request(
      "/vendor/auth/login",
      json("POST", { email, password: "VendorPass1" }),
      testEnv(),
    )
    const token = ((await login.json()) as { token: string }).token
    const sellerId = ((await res.json()) as { user: { sellerId: string } }).user.sellerId
    return { token, sellerId }
  }
  return { app, repo, checkoutRepo, authRepo, json, adminToken, buyerToken, register }
}

describe("buyer preferences (Phase 7A)", () => {
  it("locks transactional, defaults promo off and operational on", async () => {
    const { app, json, buyerToken, register } = await setup()
    const empty = await app.request("/store/preferences", { headers: { Authorization: `Bearer ${buyerToken}` } }, testEnv())
    expect(empty.status).toBe(200)
    expect(((await empty.json()) as { items: unknown[] }).items).toEqual([])

    const locked = await app.request(
      "/store/preferences",
      json("PUT", { category: "transactional", optedIn: false }, buyerToken),
      testEnv(),
    )
    expect(locked.status).toBe(400)

    const promo = await app.request(
      "/store/preferences",
      json("PUT", { category: "promotional", optedIn: true }, buyerToken),
      testEnv(),
    )
    expect(promo.status).toBe(200)
    const listed = (await (
      await app.request("/store/preferences", { headers: { Authorization: `Bearer ${buyerToken}` } }, testEnv())
    ).json()) as { items: { category: string; optedIn: boolean }[] }
    expect(listed.items).toEqual([{ channel: "sms", category: "promotional", topic: null, optedIn: true, frequencyCap: null }])

    const anon = await app.request("/store/preferences", {}, testEnv())
    expect(anon.status).toBe(401)
    const seller = await register("s@alkemart.test", "s-shop")
    const forbidden = await app.request(
      "/store/preferences",
      json("PUT", { category: "promotional", optedIn: true }, seller.token),
      testEnv(),
    )
    expect(forbidden.status).toBe(403)
  })
})

describe("subscriptions (Phase 7B)", () => {
  async function shop() {
    const s = await setup()
    const v = await s.register("v@alkemart.test", "v-shop")
    const created = await s.app.request(
      "/vendor/products",
      s.json("POST", { title: "Watch Item", primaryCategoryId: "phones", pricePesewas: "50000", onHand: 0 }, v.token),
      testEnv(),
    )
    expect(created.status).toBe(201)
    const body = (await created.json()) as {
      product: { id: string }
      variants: { variant: { id: string }; offer: { id: string } }[]
    }
    // Buyer phone resolves from their own order history (verified contact).
    return { ...s, vendor: v, productId: body.product.id, variantId: body.variants[0]!.variant.id, offerId: body.variants[0]!.offer.id }
  }

  it("validates, lists, and deletes subscriptions", async () => {
    const { app, json, buyerToken, productId, offerId } = await shop()
    const ghost = await app.request(
      "/store/subscriptions",
      json("POST", { productId: "nope", kind: "back_in_stock" }, buyerToken),
      testEnv(),
    )
    expect(ghost.status).toBe(404)
    const noTarget = await app.request(
      "/store/subscriptions",
      json("POST", { productId, kind: "price_drop" }, buyerToken),
      testEnv(),
    )
    expect(noTarget.status).toBe(400)
    const wrongOffer = await app.request(
      "/store/subscriptions",
      json("POST", { productId, offerId: "nope", kind: "back_in_stock" }, buyerToken),
      testEnv(),
    )
    expect(wrongOffer.status).toBe(400)

    const created = await app.request(
      "/store/subscriptions",
      json("POST", { productId, offerId, kind: "back_in_stock" }, buyerToken),
      testEnv(),
    )
    expect(created.status).toBe(201)
    const id = ((await created.json()) as { subscription: { id: string } }).subscription.id
    const listed = (await (
      await app.request("/store/subscriptions", { headers: { Authorization: `Bearer ${buyerToken}` } }, testEnv())
    ).json()) as { items: { id: string }[] }
    expect(listed.items.map((i) => i.id)).toEqual([id])
    const deleted = await app.request(
      `/store/subscriptions/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${buyerToken}` } },
      testEnv(),
    )
    expect(deleted.status).toBe(200)
  })

  it("fires one-shot on restock and on price drops below target", async () => {
    const ctx = await shop()
    const { app, json, buyerToken, checkoutRepo, vendor, productId, variantId, offerId } = ctx
    // Verified contact: an intent from this buyer carrying their phone
    // (intents need no sellable cart — only the contact matters here).
    const cart = await checkoutRepo.createCart()
    await checkoutRepo.createPaymentIntent({
      id: crypto.randomUUID(),
      cartId: cart.id,
      method: "cod",
      status: "initiated",
      amountPesewas: 1000n,
      currency: "ghs",
      paystackReference: null,
      buyerEmail: "buyer@alkemart.test",
      momoProvider: null,
      momoPhone: null,
      shippingAddress: {
        first_name: "Ama",
        last_name: "Mensah",
        phone: "0244123456",
        address_1: "12 High St",
        city: "Accra",
        country_code: "GH",
      },
    })
    await app.request(
      "/store/subscriptions",
      json("POST", { productId, offerId, kind: "back_in_stock" }, buyerToken),
      testEnv(),
    )
    await app.request(
      "/store/subscriptions",
      json("POST", { productId, offerId, kind: "price_drop", belowPesewas: "40000" }, buyerToken),
      testEnv(),
    )
    // Restock 0 → 5 fires back_in_stock; price unchanged so price_drop stays.
    const restock = await app.request(
      `/vendor/products/${productId}/variants/${variantId}`,
      json("PATCH", { onHand: 5 }, vendor.token),
      testEnv(),
    )
    expect(restock.status).toBe(200)
    const afterRestock = (await (
      await app.request("/store/subscriptions", { headers: { Authorization: `Bearer ${buyerToken}` } }, testEnv())
    ).json()) as { items: { kind: string }[] }
    expect(afterRestock.items.map((i) => i.kind)).toEqual(["price_drop"])

    // Price 50000 → 35000 (below the 40000 target) fires price_drop.
    const drop = await app.request(
      `/vendor/products/${productId}/variants/${variantId}`,
      json("PATCH", { pricePesewas: "35000" }, vendor.token),
      testEnv(),
    )
    expect(drop.status).toBe(200)
    const afterDrop = (await (
      await app.request("/store/subscriptions", { headers: { Authorization: `Bearer ${buyerToken}` } }, testEnv())
    ).json()) as { items: unknown[] }
    expect(afterDrop.items).toEqual([])
  })
})

describe("experiments (Phase 7D)", () => {
  it("runs the registry machine with deterministic assignment", async () => {
    const { app, json, adminToken } = await setup()
    const post = (path: string, body: unknown) =>
      app.request(path, json("POST", body, adminToken), testEnv())

    const badKey = await post("/admin/experiments", { key: "Bad Key!", name: "X" })
    expect(badKey.status).toBe(400)
    const created = await post("/admin/experiments", {
      key: "homepage-shelf-order",
      name: "Shelf order",
      controlPct: 50,
      primaryMetric: "order_delivered",
    })
    expect(created.status).toBe(201)
    const id = ((await created.json()) as { experiment: { id: string } }).experiment.id
    const dup = await post("/admin/experiments", { key: "homepage-shelf-order", name: "Y" })
    expect(dup.status).toBe(400)

    const skip = await app.request(
      `/admin/experiments/${id}`,
      json("PATCH", { status: "ended" }, adminToken),
      testEnv(),
    )
    expect(skip.status).toBe(400)
    const frozen = await app.request(
      `/admin/experiments/${id}`,
      json("PATCH", { controlPct: 10 }, adminToken),
      testEnv(),
    )
    expect(frozen.status).toBe(200)
    await app.request(`/admin/experiments/${id}`, json("PATCH", { status: "running" }, adminToken), testEnv())
    const locked = await app.request(
      `/admin/experiments/${id}`,
      json("PATCH", { controlPct: 90 }, adminToken),
      testEnv(),
    )
    expect(locked.status).toBe(400)

    const assign = async (unit: string) =>
      app.request(`/store/experiments/assign?experiment=homepage-shelf-order&unit=${unit}`, {}, testEnv())
    // The assign burst below exceeds the per-minute abuse cap on purpose;
    // reset so the test measures determinism, not the limiter. Total assigns
    // in this burst stay under the cap (2 + 24 + 1 ghost = 27 < 30).
    resetRateLimits()
    const a1 = ((await (await assign("u1")).json()) as { bucket: string }).bucket
    const a2 = ((await (await assign("u1")).json()) as { bucket: string }).bucket
    expect(a1).toBe(a2)
    const buckets = new Set<string>()
    for (let i = 0; i < 24; i++) {
      buckets.add(((await (await assign(`unit-${i}`)).json()) as { bucket: string }).bucket)
    }
    // Deterministic hash splits traffic across both buckets.
    expect(buckets).toEqual(new Set(["control", "exposed"]))
    const ghost = await app.request("/store/experiments/assign?experiment=nope&unit=u1", {}, testEnv())
    expect(ghost.status).toBe(404)

    const report = await app.request(`/admin/experiments/${id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    }, testEnv())
    const body = (await report.json()) as { report: { control: number; exposed: number } }
    // 1 repeat (u1, counted once) + 24 units.
    expect(body.report.control + body.report.exposed).toBe(25)
  })
})

describe("vendor tasks journeys (Phase 7C)", () => {
  it("surfaces stock, price, and dispatch tasks; honors topic opt-outs", async () => {
    const s = await setup()
    const v = await s.register("t@alkemart.test", "t-shop")
    const created = await s.app.request(
      "/vendor/products",
      s.json("POST", { title: "Low Item", primaryCategoryId: "phones", pricePesewas: "10000", onHand: 3 }, v.token),
      testEnv(),
    )
    const productId = ((await created.json()) as { product: { id: string } }).product.id
    // Publish so freshness/stock journeys apply (drafts stay quiet).
    const sellersRes = await s.app.request("/admin/sellers", {
      headers: { Authorization: `Bearer ${s.adminToken}` },
    }, testEnv())
    const sellerId = ((await sellersRes.json()) as { items: { id: string; handle: string }[] }).items.find(
      (x) => x.handle === "t-shop",
    )!.id
    await s.app.request(`/admin/sellers/${sellerId}/approve`, s.json("POST", {}, s.adminToken), testEnv())
    const adminProducts = await s.app.request("/admin/products", {
      headers: { Authorization: `Bearer ${s.adminToken}` },
    }, testEnv())
    const prodId = ((await adminProducts.json()) as { items: { id: string; title: string }[] }).items.find(
      (p) => p.title === "Low Item",
    )!.id
    expect(prodId).toBe(productId)
    await s.app.request(`/admin/products/${prodId}/approve`, s.json("POST", {}, s.adminToken), testEnv())

    const tasks = (await (
      await s.app.request("/vendor/tasks", { headers: { Authorization: `Bearer ${v.token}` } }, testEnv())
    ).json()) as { tasks: { kind: string; count: number }[] }
    const kinds = tasks.tasks.map((t) => t.kind)
    expect(kinds).toContain("stock")
    expect(kinds).toContain("price")
    expect(kinds).not.toContain("sla")

    await s.app.request(
      "/vendor/preferences",
      s.json("PUT", { topic: "stock", optedIn: false }, v.token),
      testEnv(),
    )
    const filtered = (await (
      await s.app.request("/vendor/tasks", { headers: { Authorization: `Bearer ${v.token}` } }, testEnv())
    ).json()) as { tasks: { kind: string }[] }
    expect(filtered.tasks.map((t) => t.kind)).not.toContain("stock")
    expect(filtered.tasks.map((t) => t.kind)).toContain("price")

    const prefs = (await (
      await s.app.request("/vendor/preferences", { headers: { Authorization: `Bearer ${v.token}` } }, testEnv())
    ).json()) as { topics: { topic: string; optedIn: boolean }[] }
    expect(prefs.topics.find((t) => t.topic === "stock")).toMatchObject({ optedIn: false })
    expect(prefs.topics.find((t) => t.topic === "price")).toMatchObject({ optedIn: true })
  })
})
