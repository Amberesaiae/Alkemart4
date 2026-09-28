import { describe, expect, it } from "vitest"
import { createApp } from "../../index"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog } from "../../demo-seed"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()


const JWT_SECRET_TEST = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv() {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: JWT_SECRET_TEST,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function appFromDemo(mutate?: (data: ReturnType<typeof demoCatalog>) => void) {
  const data = demoCatalog()
  mutate?.(data)
  return createApp({ repo: new InMemoryCatalogRepository(data) })
}

describe("GET /store/products/:id", () => {
  it("returns peer offers cheapest first", async () => {
    const res = await appFromDemo().request("/store/products/prod-tecno-spark", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      productId: string
      offers: Array<{ offerId: string; pricePesewas: string; sellerHandle: string }>
    }
    expect(body.productId).toBe("prod-tecno-spark")
    expect(body).not.toHaveProperty("price")
    expect(body).not.toHaveProperty("pricePesewas")
    expect(body.offers.map((o) => o.offerId)).toEqual(["offer-a", "offer-b"])
    expect(body.offers.map((o) => o.pricePesewas)).toEqual(["1500", "3000"])
    expect(body.offers[0]?.sellerHandle).toBe("seller-a")
  })

  it("404s when the product is missing and returns offers: [] when none sellable", async () => {
    const missing = await appFromDemo().request("/store/products/does-not-exist", {}, testEnv())
    expect(missing.status).toBe(404)

    // Sold out at an open shop: the page stays (catalogue shelf rule).
    const soldOut = await appFromDemo((data) => {
      for (const o of data.offers) if (o.productId === "prod-tecno-spark") o.active = false
    }).request("/store/products/prod-tecno-spark", {}, testEnv())
    expect(soldOut.status).toBe(200)
    const body = (await soldOut.json()) as { offers: unknown[] }
    expect(body.offers).toEqual([])
  })

  it("never shows buyers a listing that isn't published", async () => {
    for (const status of ["draft", "proposed", "rejected"] as const) {
      const res = await appFromDemo((data) => {
        data.products[0]!.status = status
      }).request("/store/products/prod-tecno-spark", {}, testEnv())
      expect(res.status).toBe(404)
    }
  })

  it("hides a suspended shop's product unless another open shop sells it", async () => {
    const app = appFromDemo((data) => {
      const own = data.products.find((p) => p.id === "prod-tecno-spark")!
      for (const sl of data.sellers) if (sl.id === own.sellerId) sl.status = "suspended"
      // Only the suspended owner's offers remain.
      data.offers = data.offers.filter((o) => o.productId !== own.id || o.sellerId === own.sellerId)
    })
    expect((await app.request("/store/products/prod-tecno-spark", {}, testEnv())).status).toBe(404)

    // Seller B still sells the same phone: the page stays, with only B's offer.
    const shared = appFromDemo((data) => {
      for (const sl of data.sellers) if (sl.id === "seller-a") sl.status = "suspended"
    })
    const res = await shared.request("/store/products/prod-tecno-spark", {}, testEnv())
    expect(res.status).toBe(200)
    const offers = ((await res.json()) as { offers: { sellerId: string }[] }).offers
    expect(offers.map((o) => o.sellerId)).toEqual(["seller-b"])
  })

  it("resolves slug-id compounds, bare slugs, and bare ids", async () => {
    const uuid = "b9e0be86-d2b2-4479-96c7-52eab2c15ec8"
    const app = appFromDemo((data) => {
      data.products.push({
        id: uuid,
        title: "Leather Sandals",
        description: null,
        slug: "leather-sandals",
        status: "published",
        primaryCategoryId: data.categories[0]!.id,
        sellerId: null,
      })
    })
    const compound = await app.request(
      `/store/products/leather-sandals-${uuid}`,
      {},
      testEnv(),
    )
    expect(compound.status).toBe(200)
    const compoundBody = (await compound.json()) as { productId: string; slug: string; canonicalRef: string }
    expect(compoundBody.productId).toBe(uuid)
    expect(compoundBody.slug).toBe("leather-sandals")
    expect(compoundBody.canonicalRef).toBe(`leather-sandals-${uuid}`)

    // Legacy fixture ids (non-UUID) keep resolving by id or slug.
    const legacy = appFromDemo((data) => {
      data.products[0]!.slug = "tecno-spark"
    })
    const bareSlug = await legacy.request("/store/products/tecno-spark", {}, testEnv())
    expect(bareSlug.status).toBe(200)
    const bareId = await legacy.request("/store/products/prod-tecno-spark", {}, testEnv())
    expect(bareId.status).toBe(200)

    // Wrong slug, right UUID still lands (slugs never break links).
    const wrongSlug = await app.request(
      `/store/products/totally-wrong-${uuid}`,
      {},
      testEnv(),
    )
    expect(wrongSlug.status).toBe(200)
    const wrongBody = (await wrongSlug.json()) as { productId: string; canonicalRef: string }
    expect(wrongBody.productId).toBe(uuid)
    expect(wrongBody.canonicalRef).toBe(`leather-sandals-${uuid}`)
  })
})
