import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import { GHANA_CATEGORY_SEED } from "@alkemart/db"
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

async function sellerToken(app: ReturnType<typeof createApp>) {
  const res = await app.request(
    "/vendor/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "health@alkemart.test",
        password: "VendorPass1",
        sellerName: "Health Shop",
        sellerHandle: "health-shop",
      }),
    },
    testEnv(),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { token: string }).token
}

describe("GET /vendor/health", () => {
  it("reports blocked standing plus profile gaps for a fresh seller", async () => {
    const snapshot = emptyCatalog()
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      jwtSecret: JWT_SECRET,
    })
    const token = await sellerToken(app)
    const res = await app.request(
      "/vendor/health",
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      status: string
      items: { key: string; state: string; href: string }[]
    }
    expect(body.status).toBe("blocked")
    const keys = body.items.map((i) => i.key)
    expect(keys).toEqual(expect.arrayContaining(["standing", "profile", "payout", "catalog"]))
    for (const item of body.items) expect(item.href.startsWith("/")).toBe(true)
  })

  it("401s anonymously", async () => {
    const snapshot = emptyCatalog()
    const app = createApp({
      authRepo: new InMemoryAuthRepository(),
      repo: new InMemoryCatalogRepository(snapshot),
      checkoutRepo: new InMemoryCheckoutRepository(snapshot),
      jwtSecret: JWT_SECRET,
    })
    const res = await app.request("/vendor/health", {}, testEnv())
    expect(res.status).toBe(401)
  })
})
