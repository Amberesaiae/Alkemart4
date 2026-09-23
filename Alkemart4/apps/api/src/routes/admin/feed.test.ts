import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog } from "../../demo-seed"
import { createApp } from "../../index"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv() {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: JWT,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

/**
 * Phase 6D — merchant feed rows and feed↔landing agreement. The feed and
 * the product detail derive from the same snapshot through independent
 * mappings; diagnostics diffs them and counts honest exclusions.
 */
describe("merchant feed (Phase 6D)", () => {
  async function setup() {
    const snapshot = demoCatalog()
    const repo = new InMemoryCatalogRepository(snapshot)
    const prod = repo.snapshot().products.find((p) => p.id === "prod-tecno-spark")!
    prod.imageUrl = "https://cdn.alkemart.test/tecno.jpg"
    prod.brand = "Tecno"
    prod.gtin = "1234567890123"
    const authRepo = new InMemoryAuthRepository()
    await authRepo.createUser({
      id: "admin-1",
      email: "admin@alkemart.test",
      passwordHash: await hashPassword("AdminPass1"),
      role: "admin",
    })
    const adminToken = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)
    const app = createApp({ repo, authRepo, jwtSecret: JWT })
    return { app, adminToken }
  }

  it("serves sellable rows with real identifiers and unknown-free gaps", async () => {
    const { app } = await setup()
    const res = await app.request("/store/feed", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: {
        productId: string
        title: string
        brand: string | null
        gtin: string | null
        pricePesewas: string
        inStock: boolean
        condition: string | null
      }[]
    }
    const row = body.items.find((i) => i.productId === "prod-tecno-spark")!
    expect(row).toMatchObject({
      title: "Tecno Spark",
      brand: "Tecno",
      gtin: "1234567890123",
      pricePesewas: "1500",
      inStock: true,
    })
    // Unknown facts stay null — the XML renderer omits the tag.
    expect(row.condition).toBeNull()
  })

  it("diagnostics agree with the landing path and count exclusions", async () => {
    const { app, adminToken } = await setup()
    const res = await app.request(
      "/admin/feed/diagnostics?limit=100",
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv(),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      checked: number
      mismatches: unknown[]
      exclusions: { missingImage: number; missingBrand: number; missingIdentifiers: number }
    }
    expect(body.checked).toBeGreaterThan(0)
    expect(body.mismatches).toEqual([])
    expect(body.exclusions.missingImage).toBe(0)
    const anon = await app.request("/admin/feed/diagnostics", {}, testEnv())
    expect(anon.status).toBe(401)
  })

  it("excludes unpublished and offer-less products from the feed", async () => {
    const { app } = await setup()
    const feed = (await (await app.request("/store/feed", {}, testEnv())).json()) as {
      items: { productId: string }[]
    }
    const ids = feed.items.map((i) => i.productId)
    // The demo catalog holds exactly one published, sellable product.
    expect(ids).toEqual(["prod-tecno-spark"])
  })
})
