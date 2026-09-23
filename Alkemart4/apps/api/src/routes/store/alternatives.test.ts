import { GHANA_CATEGORY_SEED } from "@alkemart/db"
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

function seller(id: string, handle: string) {
  return {
    id,
    handle,
    name: `${handle} Shop`,
    status: "open" as const,
    commissionBps: 700,
    deliveryFeePesewas: 0n,
    availability: "open" as const,
    pausedUntil: null,
    pauseNote: null,
  }
}

function product(id: string, title: string, category: string, sellerId: string | null, extra?: Partial<{
  brand: string | null
  productType: string | null
  status: "draft" | "proposed" | "published" | "rejected"
  imageUrl: string | null
}>) {
  return {
    id,
    title,
    description: null,
    status: extra?.status ?? "published",
    primaryCategoryId: category,
    sellerId,
    imageUrl: extra?.imageUrl ?? "https://cdn.test/x.jpg",
    attributes: [],
    brand: extra?.brand ?? null,
    model: null,
    gtin: null,
    mpn: null,
    manufacturer: null,
    productType: extra?.productType ?? null,
    identityConfidence: "seller_specific" as const,
  }
}

function variantOffer(snap: CatalogSnapshot, productId: string, sellerId: string, price: bigint, onHand: number) {
  const variantId = `var-${productId}`
  const offerId = `offer-${productId}`
  snap.variants.push({ id: variantId, productId, sku: null, title: "Default" })
  snap.offers.push({
    id: offerId,
    sellerId,
    productId,
    variantId,
    pricePesewas: price,
    onHand,
    reserved: 0,
    currency: "ghs",
    active: true,
  })
}

/**
 * Phase 8A — alternatives are attribute-aware, sellable-only, diverse, and
 * never the product itself. The rail measures `alternative_selected`, not
 * the comparison table.
 */
describe("GET /store/products/:id/alternatives (Phase 8A)", () => {
  async function setup() {
    const snap: CatalogSnapshot = {
      categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
      sellers: [seller("seller-a", "shop-a"), seller("seller-b", "shop-b")],
      products: [],
      variants: [],
      offers: [],
      productOptions: [],
      productOptionValues: [],
      variantOptionValues: [],
      attributeDefinitions: [
        {
          id: "def-storage",
          code: "phone.storage_gb",
          label: "Storage",
          type: "number",
          filterable: true,
          searchable: false,
          required: false,
          variantAxis: true,
          visibleOnCard: false,
          visibleOnPdp: true,
        },
      ],
      attributeProfiles: [],
      profileAttributes: [],
      productAttributeValues: [],
      matchCandidates: [],
      searchAliases: [],
      verifications: [],
      priceHistory: [],
    }
    snap.products.push(
      product("prod-a", "Tecno Spark", "phones", "seller-a", { brand: "Tecno", productType: "smartphone" }),
      product("prod-b", "Tecno Pop", "phones", "seller-b", { brand: "Tecno", productType: "smartphone" }),
      product("prod-c", "Ankara Gown", "women", "seller-a"),
      product("prod-draft", "Draft Phone", "phones", "seller-a", { status: "draft" }),
    )
    for (const [pid, sid, price] of [
      ["prod-a", "seller-a", 10000n],
      ["prod-b", "seller-b", 11000n],
      ["prod-c", "seller-a", 5000n],
      ["prod-draft", "seller-a", 9000n],
    ] as const) {
      variantOffer(snap, pid, sid, price, 5)
    }
    snap.productAttributeValues.push(
      { id: "v1", productId: "prod-a", definitionId: "def-storage", numberValue: 128 },
      { id: "v2", productId: "prod-b", definitionId: "def-storage", numberValue: 128 },
    )
    const app = createApp({
      repo: new InMemoryCatalogRepository(snap),
      authRepo: new InMemoryAuthRepository(),
      jwtSecret: "test-jwt-secret-that-is-at-least-32-chars-long",
    })
    return app
  }

  it("ranks the closest attribute match first and excludes self, drafts, and the unsellable", async () => {
    const app = await setup()
    const res = await app.request("/store/products/prod-a/alternatives", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { productId: string; alternatives: { productId: string }[] }
    expect(body.productId).toBe("prod-a")
    const ids = body.alternatives.map((a) => a.productId)
    // prod-b shares category, type, brand, storage, and price band.
    expect(ids[0]).toBe("prod-b")
    expect(ids).not.toContain("prod-a")
    expect(ids).not.toContain("prod-draft")
    expect(ids).toContain("prod-c")
  })

  it("caps sellers at two and answers empty for unknown products", async () => {
    const app = await setup()
    const res = await app.request("/store/products/prod-a/alternatives?limit=24", {}, testEnv())
    const body = (await res.json()) as { alternatives: { sellerId: string }[] }
    const counts = new Map<string, number>()
    for (const a of body.alternatives) {
      counts.set(a.sellerId, (counts.get(a.sellerId) ?? 0) + 1)
    }
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(2)
    const missing = await app.request("/store/products/nope/alternatives", {}, testEnv())
    expect(missing.status).toBe(200)
    expect(((await missing.json()) as { alternatives: unknown[] }).alternatives).toEqual([])
  })
})
