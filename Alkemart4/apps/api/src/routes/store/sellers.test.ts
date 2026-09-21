import { describe, expect, it } from "vitest"
import type { ProductStatus } from "@alkemart/domain"
import { createApp } from "../../index"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog, type CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: "x".repeat(32),
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function withSellerAOnlyProduct(data: CatalogSnapshot): CatalogSnapshot {
  return {
    ...data,
    products: [
      ...data.products,
      {
        id: "prod-royal-rice",
        title: "Royal Stallion Rice",
        description: "50kg bag",
        status: "published" as ProductStatus,
        primaryCategoryId: "staples",
        sellerId: "seller-a",
      },
    ],
    variants: [
      ...data.variants,
      { id: "var-royal-rice", productId: "prod-royal-rice", sku: "RICE-50KG", title: "50kg" },
    ],
    offers: [
      ...data.offers,
      {
        id: "offer-rice-a",
        sellerId: "seller-a",
        productId: "prod-royal-rice",
        variantId: "var-royal-rice",
        pricePesewas: 8000n,
        onHand: 20,
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
    matchCandidates: [],
  }
}

function shopApp() {
  return createApp({
    authRepo: new InMemoryAuthRepository(),
    repo: new InMemoryCatalogRepository(withSellerAOnlyProduct(demoCatalog())),
  })
}

describe("GET /store/sellers/:handle", () => {
  it("returns only that seller's sellable offers as product cards", async () => {
    const app = shopApp()

    const a = await app.request("/store/sellers/seller-a", {}, testEnv())
    expect(a.status).toBe(200)
    const aBody = (await a.json()) as {
      seller: {
        id: string
        handle: string
        name: string
        description: null
        logo: null
        banner: null
        trust: {
          ratingAvg: number | null
          ratingCount: number
          salesCount: number
          recentReviews: unknown[]
        } | null
      }
      items: Array<{ productId: string; offerCount: number; fromPricePesewas: string }>
    }
    expect(aBody.seller).toMatchObject({ id: "seller-a", handle: "seller-a", name: "Accra Mart", availability: { state: "open", pausedUntil: null, note: null }, description: null, logo: null, banner: null })
    expect(aBody.seller.trust).toMatchObject({ ratingCount: expect.any(Number), salesCount: expect.any(Number), recentReviews: expect.any(Array) })
    const aIds = aBody.items.map((i) => i.productId).sort()
    expect(aIds).toEqual(["prod-royal-rice", "prod-tecno-spark"])
    const phone = aBody.items.find((i) => i.productId === "prod-tecno-spark")
    expect(phone?.offerCount).toBe(1)
    expect(phone?.fromPricePesewas).toBe("1500")

    const b = await app.request("/store/sellers/seller-b", {}, testEnv())
    expect(b.status).toBe(200)
    const bBody = (await b.json()) as {
      items: Array<{ productId: string; offerCount: number }>
    }
    expect(bBody.items.map((i) => i.productId)).toEqual(["prod-tecno-spark"])
    expect(bBody.items[0]?.offerCount).toBe(1)
    expect(bBody.items.some((i) => i.productId === "prod-royal-rice")).toBe(false)
  })

  it("404s for an unknown seller handle", async () => {
    const res = await shopApp().request("/store/sellers/no-such-seller", {}, testEnv())
    expect(res.status).toBe(404)
  })
})

describe("GET /store/sellers (stores index cards)", () => {
  it("returns a card per open shop with honest empty trust fields", async () => {
    const res = await shopApp().request("/store/sellers", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      sellers: Array<{
        handle: string
        ratingAvg: number | null
        ratingCount: number
        deliveryMinutes: number | null
        badges: { id: string }[]
        featured: unknown[]
      }>
    }
    expect(body.sellers.length).toBeGreaterThan(0)
    const a = body.sellers.find((s) => s.handle === "seller-a")
    expect(a).toBeDefined()
    // Nothing reviewed, nothing declared: the card says so by omission
    // rather than rendering a zero rating or a default delivery promise.
    expect(a!.ratingAvg).toBeNull()
    expect(a!.ratingCount).toBe(0)
    expect(a!.deliveryMinutes).toBeNull()
    expect(a!.featured).toEqual([])
  })

  it("never invents a rating or a delivery band", async () => {
    const res = await shopApp().request("/store/sellers", {}, testEnv())
    const body = (await res.json()) as {
      sellers: Array<{ ratingAvg: number | null; deliveryMinutes: number | null; badges: { id: string }[] }>
    }
    for (const s of body.sellers) {
      expect(s.ratingAvg).toBeNull()
      expect(s.deliveryMinutes).toBeNull()
      expect(s.badges.map((b) => b.id)).not.toContain("top_rated")
      expect(s.badges.map((b) => b.id)).not.toContain("fast_delivery")
    }
  })

  it("keeps the legacy items alias so existing clients keep working", async () => {
    const res = await shopApp().request("/store/sellers", {}, testEnv())
    const body = (await res.json()) as { sellers: unknown[]; items: unknown[] }
    expect(body.items).toEqual(body.sellers)
  })
})
