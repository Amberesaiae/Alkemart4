import { describe, expect, it } from "vitest"
import { createApp } from "../../index"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import { snapshotFromJson, type JsonCatalogSnapshot } from "../../demo-seed"
import fixture from "../../fixtures/multivendor-demo.json"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

function appFromDemo() {
  const data = snapshotFromJson(fixture as JsonCatalogSnapshot)
  return createApp({ repo: new InMemoryCatalogRepository(data) })
}

describe("GET /store/catalog", () => {
  it("aggregates 2 sellable offers into one PLP card with cheaper fromPrice", async () => {
    const res = await appFromDemo().request("/store/catalog")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>
      total: number
    }
    expect(body.total).toBe(1)
    expect(body.items).toHaveLength(1)
    const card = body.items[0]!
    expect(card.productId).toBe("prod-tecno-spark")
    expect(card.offerCount).toBe(2)
    expect(card.fromPricePesewas).toBe("1500")
    expect(card.bestOfferId).toBe("offer-a")
    expect(card.currency).toBe("GHS")
    expect(card).not.toHaveProperty("price")
    expect(card).not.toHaveProperty("pricePesewas")
  })

  it("joins published ratings onto cards and leaves unrated cards bare", async () => {
    const data = snapshotFromJson(fixture as JsonCatalogSnapshot)
    const checkoutRepo = new InMemoryCheckoutRepository(data)
    const app = createApp({ repo: new InMemoryCatalogRepository(data), checkoutRepo })

    const review = await checkoutRepo.createReview({
      orderId: "order-1",
      productId: "prod-tecno-spark",
      sellerId: "seller-a",
      buyerEmail: "buyer@example.com",
      rating: 4,
      title: null,
      body: "Solid phone for the price.",
    })
    expect(review).not.toBeNull()
    await checkoutRepo.updateReviewStatus(review!.id, "published")

    const res = await app.request("/store/catalog")
    const body = (await res.json()) as { items: Array<Record<string, unknown>> }
    expect(body.items[0]).toMatchObject({ productId: "prod-tecno-spark", ratingAvg: 4, ratingCount: 1 })

    // A hidden review is not a rating, and an unrated card carries no fields at
    // all — never a zero, which buyers would read as a bad score.
    await checkoutRepo.updateReviewStatus(review!.id, "hidden")
    const again = (await (await app.request("/store/catalog")).json()) as {
      items: Array<Record<string, unknown>>
    }
    expect(again.items[0]).not.toHaveProperty("ratingAvg")
    expect(again.items[0]).not.toHaveProperty("ratingCount")
  })

  it("filters by category handle including descendants", async () => {
    const app = appFromDemo()
    const phones = await app.request("/store/catalog?category=phones")
    expect(phones.status).toBe(200)
    const phonesBody = (await phones.json()) as { items: unknown[]; total: number }
    expect(phonesBody.total).toBe(1)

    const parent = await app.request("/store/catalog?category=phones-electronics")
    const parentBody = (await parent.json()) as { items: unknown[]; total: number }
    expect(parentBody.total).toBe(1)

    const empty = await app.request("/store/catalog?category=beverages")
    const emptyBody = (await empty.json()) as { items: unknown[]; total: number }
    expect(emptyBody.total).toBe(0)
    expect(emptyBody.items).toEqual([])
  })
})

describe("GET /store/catalog/popular", () => {
  it("returns an empty shelf rather than 500 when nothing has sold", async () => {
    const res = await appFromDemo().request("/store/catalog/popular")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { items: unknown[]; total: number }
    expect(body.items).toEqual([])
    expect(body.total).toBe(0)
  })
})

describe("GET /store/categories", () => {
  it("returns a nav tree rooted at Ghana departments", async () => {
    const res = await appFromDemo().request("/store/categories")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      categories: Array<{ handle: string; children: Array<{ handle: string }> }>
    }
    const handles = body.categories.map((n) => n.handle)
    expect(handles).toContain("phones-electronics")
    const phones = body.categories.find((n) => n.handle === "phones-electronics")
    expect(phones?.children.map((c) => c.handle)).toContain("phones")
  })
})
