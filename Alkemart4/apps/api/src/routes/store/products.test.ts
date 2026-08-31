import { describe, expect, it } from "vitest"
import { createApp } from "../../index"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog } from "../../demo-seed"

function appFromDemo(mutate?: (data: ReturnType<typeof demoCatalog>) => void) {
  const data = demoCatalog()
  mutate?.(data)
  return createApp({ repo: new InMemoryCatalogRepository(data) })
}

describe("GET /store/products/:id", () => {
  it("returns peer offers cheapest first", async () => {
    const res = await appFromDemo().request("/store/products/prod-tecno-spark")
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
    const missing = await appFromDemo().request("/store/products/does-not-exist")
    expect(missing.status).toBe(404)

    const unpublished = await appFromDemo((data) => {
      data.products[0]!.status = "draft"
    }).request("/store/products/prod-tecno-spark")
    expect(unpublished.status).toBe(200)
    const body = (await unpublished.json()) as { offers: unknown[] }
    expect(body.offers).toEqual([])
  })
})
