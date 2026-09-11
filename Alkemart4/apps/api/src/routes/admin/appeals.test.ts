import { hashPassword } from "@alkemart/domain"
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

async function setup() {
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const snapshot: CatalogSnapshot = {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [],
    products: [],
    variants: [],
    offers: [],
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
  }
  const app = createApp({
    authRepo,
    repo: new InMemoryCatalogRepository(snapshot),
    checkoutRepo: new InMemoryCheckoutRepository(snapshot),
    jwtSecret: JWT_SECRET,
  })
  const adminLogin = await app.request(
    "/admin/auth/login",
    json("POST", { email: "admin@alkemart.test", password: "AdminPass1" }),
    testEnv(),
  )
  const adminToken = ((await adminLogin.json()) as { token: string }).token

  const vendor = await app.request(
    "/vendor/auth/register",
    json("POST", {
      email: "appeals@alkemart.test",
      password: "VendorPass1",
      sellerName: "Appeals Shop",
      sellerHandle: "appeals-shop",
    }),
    testEnv(),
  )
  const sellerToken = ((await vendor.json()) as { token: string }).token

  const created = await app.request(
    "/vendor/products",
    json(
      "POST",
      {
        title: "Appealable Item",
        primaryCategoryId: "phones",
        pricePesewas: "50000",
        onHand: 2,
      },
      sellerToken,
    ),
    testEnv(),
  )
  const productId = ((await created.json()) as { product: { id: string } }).product.id
  return { app, adminToken, sellerToken, productId }
}

describe("moderation appeals loop", () => {
  it("vendor appeals a rejection; admin reopens to proposed", async () => {
    const { app, adminToken, sellerToken, productId } = await setup()
    const auth = { headers: { Authorization: `Bearer ${sellerToken}` } }
    const adminAuth = { headers: { Authorization: `Bearer ${adminToken}` } }

    // Only rejected products can be appealed.
    const early = await app.request(`/vendor/products/${productId}/appeal`, json("POST", { message: "please" }, sellerToken), testEnv())
    expect(early.status).toBe(400)

    // Admin rejects.
    const rejected = await app.request(`/admin/products/${productId}/reject`, json("POST", {}, adminToken), testEnv())
    expect(rejected.status).toBe(200)

    // Vendor appeals.
    const appeal = await app.request(
      `/vendor/products/${productId}/appeal`,
      json("POST", { message: "My photos were placeholders, fixed now." }, sellerToken),
      testEnv(),
    )
    expect(appeal.status).toBe(201)

    // Duplicate open appeal is rejected.
    const dup = await app.request(
      `/vendor/products/${productId}/appeal`,
      json("POST", { message: "again" }, sellerToken),
      testEnv(),
    )
    expect(dup.status).toBe(409)

    // Admin inbox lists it with context.
    const inbox = await app.request("/admin/appeals", adminAuth, testEnv())
    expect(inbox.status).toBe(200)
    const inboxBody = (await inbox.json()) as { appeals: { id: string; message: string }[] }
    expect(inboxBody.appeals).toHaveLength(1)
    const appealId = inboxBody.appeals[0].id

    // Admin reopens → product proposed again, appeal closed.
    const reopen = await app.request(
      `/admin/appeals/${appealId}/resolve`,
      json("POST", { decision: "reopen", note: "Photos fixed, welcome back." }, adminToken),
      testEnv(),
    )
    expect(reopen.status).toBe(200)
    const reopenBody = (await reopen.json()) as { appeal: { decision: string; status: string } }
    expect(reopenBody.appeal).toMatchObject({ decision: "reopened", status: "closed" })

    const mine = await app.request("/vendor/products/appeals/mine", auth, testEnv())
    expect(mine.status).toBe(200)

    const inbox2 = await app.request("/admin/appeals", adminAuth, testEnv())
    expect(((await inbox2.json()) as { appeals: unknown[] }).appeals).toHaveLength(0)
  })

  it("uphold keeps the rejection and closes the appeal", async () => {
    const { app, adminToken, sellerToken, productId } = await setup()
    await app.request(`/admin/products/${productId}/reject`, json("POST", {}, adminToken), testEnv())
    await app.request(
      `/vendor/products/${productId}/appeal`,
      json("POST", { message: "I disagree." }, sellerToken),
      testEnv(),
    )
    const inbox = await app.request(
      "/admin/appeals",
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv(),
    )
    const appealId = ((await inbox.json()) as { appeals: { id: string }[] }).appeals[0].id
    const res = await app.request(
      `/admin/appeals/${appealId}/resolve`,
      json("POST", { decision: "uphold", note: "Still counterfeit." }, adminToken),
      testEnv(),
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { appeal: { decision: string } }).appeal.decision).toBe("upheld")
  })
})
