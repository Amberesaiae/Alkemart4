import { hashPassword, type OrderFact } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAdminAuditLog } from "../../admin-audit"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository, type CheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

async function adminApp(verified = true) {
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
    attributeDefinitions: [],
    attributeProfiles: [],
    profileAttributes: [],
    productAttributeValues: [],
    matchCandidates: [],
    searchAliases: [],
    verifications: [],
    priceHistory: [],
  }
  const repo = new InMemoryCatalogRepository(snapshot)
  const auditLog = new InMemoryAdminAuditLog()
  const app = createApp({
    authRepo,
    repo,
    checkoutRepo: new InMemoryCheckoutRepository(snapshot),
    auditLog,
    jwtSecret: JWT_SECRET,
  })
  const login = await app.request("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
  })
  expect(login.status).toBe(200)
  const { token } = (await login.json()) as { token: string }

  const vendor = await app.request("/vendor/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "seller@alkemart.test",
      password: "VendorPass1",
      sellerName: "Ama Shop",
      sellerHandle: "ama-shop",
    }),
  })
  expect(vendor.status).toBe(201)
  const vendorBody = (await vendor.json()) as { user: { sellerId: string } }
  if (verified) {
    const owner = await authRepo.findUserByEmail("seller@alkemart.test")
    await authRepo.markEmailVerified(owner!.id)
  }
  return { app, authRepo, auditLog, token, sellerId: vendorBody.user.sellerId }
}

function authPost(token: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  return {
    method: "POST" as const,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }
}

describe("GET /admin/sellers", () => {
  it("includes the owner email per shop for the ops queue", async () => {
    const { app, token, sellerId } = await adminApp()
    const res = await app.request("/admin/sellers", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: { id: string; ownerEmail: string | null; status: string }[]
    }
    const row = body.items.find((i) => i.id === sellerId)
    expect(row?.status).toBe("pending_approval")
    expect(row?.ownerEmail).toBe("seller@alkemart.test")
  })
})

describe("GET /admin/sellers totals", () => {
  it("match Insights → Business: cancelled orders and delivery fees don't count", async () => {
    const authRepo = new InMemoryAuthRepository()
    await authRepo.createUser({ id: "admin-1", email: "admin@alkemart.test", passwordHash: await hashPassword("AdminPass1"), role: "admin" })
    await authRepo.registerVendor({ user: { id: "u1", email: "s@alkemart.test", passwordHash: "x" }, seller: { id: "s1", handle: "s1", name: "S1" } })
    const fact = (status: OrderFact["status"], subtotal: bigint): OrderFact => ({
      orderId: crypto.randomUUID(), orderGroupId: crypto.randomUUID(), sellerId: "s1", placedAt: new Date(Date.now() - 86_400_000),
      status, deliveredAt: null, subtotalPesewas: subtotal, deliveryFeePesewas: 1000n, paymentMethod: "cod", fulfillmentMethod: "delivery",
      buyerKey: "b@x.test", region: null, city: null, items: [{ productId: "p", title: "P", qty: 1, amountPesewas: subtotal }],
    })
    const facts = [fact("delivered", 5000n), fact("placed", 2000n), fact("cancelled", 90000n)]
    const checkoutRepo = { listOrderFacts: async () => facts } as unknown as CheckoutRepository
    const app = createApp({ authRepo, checkoutRepo, jwtSecret: JWT_SECRET })
    const login = await app.request("/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
    })
    const token = ((await login.json()) as { token: string }).token
    const res = await app.request("/admin/sellers", { headers: { Authorization: `Bearer ${token}` } })
    const row = ((await res.json()) as { items: { id: string; orderCount: number; gmvPesewas: string }[] }).items.find((i) => i.id === "s1")
    expect(row).toMatchObject({ orderCount: 2, gmvPesewas: "7000" })
  })
})

describe("POST /admin/sellers/:id/approve", () => {
  it("blocks approval until the shop owner verifies their email", async () => {
    const { app, token, sellerId } = await adminApp(false)
    const res = await app.request(`/admin/sellers/${sellerId}/approve`, authPost(token))
    expect(res.status).toBe(409)
  })
  it("sets seller status to open", async () => {
    const { app, authRepo, token, sellerId } = await adminApp()
    const before = await authRepo.findSellerById(sellerId)
    expect(before?.status).toBe("pending_approval")

    const res = await app.request(`/admin/sellers/${sellerId}/approve`, authPost(token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: { id: string; status: string } }
    expect(body.seller.id).toBe(sellerId)
    expect(body.seller.status).toBe("open")

    const after = await authRepo.findSellerById(sellerId)
    expect(after?.status).toBe("open")
  })

  it("writes an audit row with the acting admin", async () => {
    const { app, auditLog, token, sellerId } = await adminApp()
    const res = await app.request(`/admin/sellers/${sellerId}/approve`, authPost(token))
    expect(res.status).toBe(200)
    expect(auditLog.rows).toHaveLength(1)
    expect(auditLog.rows[0]).toMatchObject({
      action: "seller.approve",
      targetType: "seller",
      targetId: sellerId,
    })
    expect(auditLog.rows[0].adminUserId).toBe("admin-1")

    const listed = await app.request("/admin/actions", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(listed.status).toBe(200)
    const listedBody = (await listed.json()) as { items: { action: string }[] }
    expect(listedBody.items.map((i) => i.action)).toEqual(["seller.approve"])
  })
})

describe("GET /admin/sellers/:id", () => {
  it("returns the seller with members, counts, and recent orders", async () => {
    const { app, token, sellerId } = await adminApp()
    const res = await app.request(`/admin/sellers/${sellerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      seller: {
        id: string
        handle: string
        email: string | null
        members: { id: string; is_owner: boolean; member: { email: string } }[]
      }
      counts: { products: Record<string, number>; orders: Record<string, number>; members: number }
      recentOrders: unknown[]
    }
    expect(body.seller.id).toBe(sellerId)
    expect(body.seller.handle).toBe("ama-shop")
    expect(body.seller.email).toBe("seller@alkemart.test")
    expect(body.seller.members).toHaveLength(1)
    expect(body.seller.members[0].is_owner).toBe(true)
    expect(body.counts.members).toBe(1)
    expect(body.recentOrders).toEqual([])
  })

  it("404s on unknown sellers and 401s without admin auth", async () => {
    const { app, token } = await adminApp()
    const missing = await app.request("/admin/sellers/nope", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(missing.status).toBe(404)
    const anon = await app.request("/admin/sellers/nope")
    expect(anon.status).toBe(401)
  })
})
