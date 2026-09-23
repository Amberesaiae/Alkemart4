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

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars-long",
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

/**
 * Phase 8D — taxonomy evidence pipelines. Proposals are read-only leads a
 * human approves through the taxonomy/match endpoints; nothing auto-applies.
 */
describe("GET /admin/taxonomy/proposals/review (Phase 8D)", () => {
  it("surfaces other-bucket, thin-leaf, and rejected-match leads", async () => {
    const snap: CatalogSnapshot = {
      categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
      sellers: [
        {
          id: "seller-a",
          handle: "shop-a",
          name: "Shop A",
          status: "open",
          commissionBps: 700,
          deliveryFeePesewas: 0n,
          availability: "open",
          pausedUntil: null,
          pauseNote: null,
        },
      ],
      products: [
        {
          id: "prod-other",
          title: "Mystery Item",
          description: null,
          status: "published",
          primaryCategoryId: "other",
          sellerId: "seller-a",
          imageUrl: null,
          attributes: [],
          brand: null,
          model: null,
          gtin: null,
          mpn: null,
          manufacturer: null,
          productType: null,
          identityConfidence: "seller_specific",
        },
        {
          id: "prod-shoe",
          title: "Lone Shoe",
          description: null,
          status: "published",
          primaryCategoryId: "shoes",
          sellerId: "seller-a",
          imageUrl: null,
          attributes: [],
          brand: null,
          model: null,
          gtin: null,
          mpn: null,
          manufacturer: null,
          productType: null,
          identityConfidence: "seller_specific",
        },
      ],
      variants: [
        { id: "var-other", productId: "prod-other", sku: null, title: "Default" },
        { id: "var-shoe", productId: "prod-shoe", sku: null, title: "Default" },
      ],
      offers: [
        {
          id: "offer-other",
          sellerId: "seller-a",
          productId: "prod-other",
          variantId: "var-other",
          pricePesewas: 1000n,
          onHand: 2,
          reserved: 0,
          currency: "ghs",
          active: true,
        },
        {
          id: "offer-shoe",
          sellerId: "seller-a",
          productId: "prod-shoe",
          variantId: "var-shoe",
          pricePesewas: 2000n,
          onHand: 2,
          reserved: 0,
          currency: "ghs",
          active: true,
        },
      ],
      productOptions: [],
      productOptionValues: [],
      variantOptionValues: [],
      attributeDefinitions: [],
      attributeProfiles: [],
      profileAttributes: [],
      productAttributeValues: [],
      matchCandidates: [
        {
          id: "match-1",
          productId: "prod-other",
          candidateProductId: "prod-shoe",
          source: "admin",
          evidence: null,
          status: "rejected",
          reviewerId: "admin-1",
          reviewedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
      searchAliases: [],
      verifications: [],
      priceHistory: [],
    }
    const authRepo = new InMemoryAuthRepository()
    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    const app = createApp({
      repo: new InMemoryCatalogRepository(snap),
      authRepo,
      jwtSecret: "test-jwt-secret-that-is-at-least-32-chars-long",
    })
    const login = await app.request(
      "/admin/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
      },
      testEnv(),
    )
    const token = ((await login.json()) as { token: string }).token
    const res = await app.request(
      "/admin/taxonomy/proposals/review",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      count: number
      proposals: { kind: string; ref: string; count: number; sample: string[] }[]
    }
    const kinds = body.proposals.map((p) => p.kind)
    expect(kinds).toContain("other_bucket")
    expect(kinds).toContain("thin_category")
    expect(kinds).toContain("failed_match")
    expect(body.count).toBe(body.proposals.length)
    const other = body.proposals.find((p) => p.kind === "other_bucket")!
    expect(other.sample).toContain("prod-other")
    const thin = body.proposals.find((p) => p.kind === "thin_category")!
    expect(thin.ref).toBe("shoes")
  })
})
