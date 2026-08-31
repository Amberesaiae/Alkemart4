import { describe, expect, it } from "vitest"
import type { ProductStatus } from "@alkemart/domain"
import { createApp } from "../../index"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog, type CatalogSnapshot } from "../../demo-seed"

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
  }
}

function shopApp() {
  return createApp({ repo: new InMemoryCatalogRepository(withSellerAOnlyProduct(demoCatalog())) })
}

describe("GET /store/sellers/:handle", () => {
  it("returns only that seller's sellable offers as product cards", async () => {
    const app = shopApp()

    const a = await app.request("/store/sellers/seller-a")
    expect(a.status).toBe(200)
    const aBody = (await a.json()) as {
      seller: { id: string; handle: string; name: string }
      items: Array<{ productId: string; offerCount: number; fromPricePesewas: string }>
    }
    expect(aBody.seller).toEqual({ id: "seller-a", handle: "seller-a", name: "Accra Mart" })
    const aIds = aBody.items.map((i) => i.productId).sort()
    expect(aIds).toEqual(["prod-royal-rice", "prod-tecno-spark"])
    const phone = aBody.items.find((i) => i.productId === "prod-tecno-spark")
    expect(phone?.offerCount).toBe(1)
    expect(phone?.fromPricePesewas).toBe("1500")

    const b = await app.request("/store/sellers/seller-b")
    expect(b.status).toBe(200)
    const bBody = (await b.json()) as {
      items: Array<{ productId: string; offerCount: number }>
    }
    expect(bBody.items.map((i) => i.productId)).toEqual(["prod-tecno-spark"])
    expect(bBody.items[0]?.offerCount).toBe(1)
    expect(bBody.items.some((i) => i.productId === "prod-royal-rice")).toBe(false)
  })

  it("404s for an unknown seller handle", async () => {
    const res = await shopApp().request("/store/sellers/no-such-seller")
    expect(res.status).toBe(404)
  })
})
