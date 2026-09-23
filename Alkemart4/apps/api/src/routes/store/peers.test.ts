import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAdminAuditLog } from "../../admin-audit"
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

function emptySnapshot(): CatalogSnapshot {
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

function sellerRow(id: string, handle: string, deliveryFee: bigint) {
  return {
    id,
    handle,
    name: `${handle} Shop`,
    status: "open" as const,
    commissionBps: 700,
    deliveryFeePesewas: deliveryFee,
    availability: "open" as const,
    pausedUntil: null,
    pauseNote: null,
  }
}

describe("GET /store/products/:id/peers (Phase 3B)", () => {
  async function peerApp() {
    const snapshot = emptySnapshot()
    snapshot.sellers.push(sellerRow("seller-1", "shop-one", 0n), sellerRow("seller-2", "shop-two", 500n))
    snapshot.products.push({
      id: "product-1",
      title: "Matched Phone",
      description: null,
      status: "published",
      primaryCategoryId: "phones",
      sellerId: null,
      imageUrl: null,
      attributes: [],
      brand: "Tecno",
      model: "Spark",
      gtin: null,
      mpn: null,
      manufacturer: null,
      productType: null,
      identityConfidence: "matched",
    })
    snapshot.products.push({
      id: "product-c",
      title: "Level C Item",
      description: null,
      status: "published",
      primaryCategoryId: "phones",
      sellerId: "seller-1",
      imageUrl: null,
      attributes: [],
      brand: null,
      model: null,
      gtin: null,
      mpn: null,
      manufacturer: null,
      productType: null,
      identityConfidence: "seller_specific",
    })
    snapshot.variants.push(
      { id: "variant-1", productId: "product-1", sku: null, title: "Default" },
      { id: "variant-c", productId: "product-c", sku: null, title: "Default" },
    )
    snapshot.offers.push(
      {
        id: "offer-1", sellerId: "seller-1", productId: "product-1", variantId: "variant-1",
        pricePesewas: 10000n, onHand: 5, reserved: 0, currency: "ghs", active: true,
      },
      {
        id: "offer-2", sellerId: "seller-2", productId: "product-1", variantId: "variant-1",
        pricePesewas: 9000n, onHand: 5, reserved: 0, currency: "ghs", active: true,
      },
      {
        id: "offer-c", sellerId: "seller-1", productId: "product-c", variantId: "variant-c",
        pricePesewas: 7000n, onHand: 5, reserved: 0, currency: "ghs", active: true,
      },
    )
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      auditLog: new InMemoryAdminAuditLog(),
      jwtSecret: JWT_SECRET,
    })
    return app
  }

  it("ranks by total payable cost with an explanation", async () => {
    const app = await peerApp()
    const res = await app.request("/store/products/product-1/peers", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      comparisonEligible: boolean
      offers: { offerId: string }[]
      explanation: string
      divergenceNeedsReview: boolean
    }
    expect(body.comparisonEligible).toBe(true)
    // offer-2 totals 9500 (9000 + 500 delivery) < offer-1 totals 10000.
    expect(body.offers.map((o) => o.offerId)).toEqual(["offer-2", "offer-1"])
    expect(body.explanation).toMatch(/total payable cost/)
    expect(body.divergenceNeedsReview).toBe(false)
  })

  it("honours price sort and filters to one variant", async () => {
    const app = await peerApp()
    const res = await app.request("/store/products/product-1/peers?sort=price", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { offers: { offerId: string }[]; explanation: string }
    expect(body.offers.map((o) => o.offerId)).toEqual(["offer-2", "offer-1"])
    expect(body.explanation).toMatch(/item price/)
    const filtered = await app.request(
      "/store/products/product-1/peers?variant_id=variant-1",
      {},
      testEnv(),
    )
    expect(filtered.status).toBe(200)
    expect(((await filtered.json()) as { variantId: string }).variantId).toBe("variant-1")
  })

  it("shows no comparison claims for Level C products and 404s unknown ids", async () => {
    const app = await peerApp()
    const levelC = await app.request("/store/products/product-c/peers", {}, testEnv())
    expect(levelC.status).toBe(200)
    const body = (await levelC.json()) as { comparisonEligible: boolean; offers: unknown[] }
    expect(body.comparisonEligible).toBe(false)
    expect(body.offers).toEqual([])
    const missing = await app.request("/store/products/nope/peers", {}, testEnv())
    expect(missing.status).toBe(404)
    const badVariant = await app.request(
      "/store/products/product-1/peers?variant_id=nope",
      {},
      testEnv(),
    )
    expect(badVariant.status).toBe(404)
  })
})

describe("Phase 3A offer terms + 3D verification loop", () => {
  async function fullApp() {
    const authRepo = new InMemoryAuthRepository()
    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    const snapshot = emptySnapshot()
    const repo = new InMemoryCatalogRepository(snapshot)
    const app = createApp({
      authRepo,
      repo,
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      auditLog: new InMemoryAdminAuditLog(),
      jwtSecret: JWT_SECRET,
    })
    const adminLogin = await app.request(
      "/admin/auth/login",
      json("POST", { email: "admin@alkemart.test", password: "AdminPass1" }),
      testEnv(),
    )
    expect(adminLogin.status).toBe(200)
    const adminToken = ((await adminLogin.json()) as { token: string }).token
    const registered = await app.request(
      "/vendor/auth/register",
      json("POST", {
        email: "phase3@alkemart.test",
        password: "VendorPass1",
        sellerName: "Phase3 Shop",
        sellerHandle: "phase3-shop",
      }),
      testEnv(),
    )
    expect(registered.status).toBe(201)
    const sellerId = ((await registered.json()) as { user: { sellerId: string } }).user.sellerId
    // The vendor owns catalog rows; mirror the seller profile into the catalog
    // snapshot so verification evidence has a seller to attach to.
    repo.snapshot().sellers.push(sellerRow(sellerId, "phase3-shop", 0n))
    const vendorLogin = await app.request(
      "/vendor/auth/login",
      json("POST", { email: "phase3@alkemart.test", password: "VendorPass1" }),
      testEnv(),
    )
    expect(vendorLogin.status).toBe(200)
    const sellerToken = ((await vendorLogin.json()) as { token: string }).token
    const created = await app.request(
      "/vendor/products",
      json("POST", { title: "Phase3 Gown", primaryCategoryId: "women", pricePesewas: "50000", onHand: 4 }, sellerToken),
      testEnv(),
    )
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as {
      product: { id: string }
      variants: { variant: { id: string } }[]
    }
    return { app, repo, adminToken, sellerToken, sellerId, productId: createdBody.product.id, variantId: createdBody.variants[0]!.variant.id }
  }

  it("rejects compare-at without provenance and accepts it with provenance", async () => {
    const { app, repo, adminToken, sellerToken, sellerId, productId, variantId } = await fullApp()
    const bare = await app.request(
      `/vendor/products/${productId}/variants/${variantId}`,
      json("PATCH", { compareAtPesewas: "60000" }, sellerToken),
      testEnv(),
    )
    expect(bare.status).toBe(400)
    const ok = await app.request(
      `/vendor/products/${productId}/variants/${variantId}`,
      json(
        "PATCH",
        { pricePesewas: "55000", compareAtPesewas: "60000", compareAtProvenance: "Supplier list price" },
        sellerToken,
      ),
      testEnv(),
    )
    expect(ok.status).toBe(200)
    // The price move lands in the append-only history with its actor.
    expect(repo.snapshot().priceHistory).toHaveLength(1)
    expect(repo.snapshot().priceHistory[0]).toMatchObject({
      oldPricePesewas: "50000",
      newPricePesewas: "55000",
      changedBy: expect.any(String),
    })
    // …and the store peers read surfaces that trail per offer.
    // (Approval makes the offer sellable so it appears in the comparison.)
    const approveSeller = await app.request(
      `/admin/sellers/${sellerId}/approve`,
      json("POST", {}, adminToken),
      testEnv(),
    )
    expect(approveSeller.status).toBe(200)
    const approveProduct = await app.request(
      `/admin/products/${productId}/approve`,
      json("POST", {}, adminToken),
      testEnv(),
    )
    expect(approveProduct.status).toBe(200)
    await repo.promoteProductIdentity(productId, "matched", "admin-1")
    const offerId = repo.snapshot().offers.find((o) => o.productId === productId)?.id
    const peers = await app.request(`/store/products/${productId}/peers`, {}, testEnv())
    expect(peers.status).toBe(200)
    const trail = ((await peers.json()) as { priceHistory: Record<string, { oldPricePesewas: string }[]> }).priceHistory
    expect(trail[offerId!]).toHaveLength(1)
    expect(trail[offerId!][0]).toMatchObject({ oldPricePesewas: "50000" })
  })

  it("issues, reads, and revokes verification evidence", async () => {
    const { app, adminToken, sellerId } = await fullApp()
    const issued = await app.request(
      `/admin/sellers/${sellerId}/verifications`,
      json("POST", { kind: "identity", evidence: "doc-123" }, adminToken),
      testEnv(),
    )
    expect(issued.status).toBe(201)
    const verification = ((await issued.json()) as { verification: { id: string; status: string; meaning: string } }).verification
    expect(verification.status).toBe("pending")
    expect(verification.meaning).toMatch(/Identity verified/)
    const store = await app.request("/store/sellers/phase3-shop/verifications", {}, testEnv())
    expect(store.status).toBe(200)
    const listed = ((await store.json()) as { verifications: { id: string }[] }).verifications
    expect(listed.map((v) => v.id)).toContain(verification.id)
    const revoked = await app.request(
      `/admin/sellers/${sellerId}/verifications/${verification.id}/revoke`,
      json("POST", { reason: "document expired" }, adminToken),
      testEnv(),
    )
    expect(revoked.status).toBe(200)
    expect(((await revoked.json()) as { verification: { status: string } }).verification.status).toBe("revoked")
  })
})
