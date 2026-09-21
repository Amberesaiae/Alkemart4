import { describe, expect, it } from "vitest"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { demoCatalog, type CatalogSnapshot } from "../../demo-seed"
import { createApp } from "../../index"

function searchSnapshot(): CatalogSnapshot {
  const data = demoCatalog()
  data.products.push({
    id: "prod-samsung-a14",
    title: "Samsung Galaxy A14",
    description: "Budget Samsung phone",
    status: "published",
    primaryCategoryId: "phones",
    sellerId: "seller-b",
    brand: "Samsung",
    model: "Galaxy A14",
    identityConfidence: "matched",
  })
  data.variants.push({ id: "var-a14", productId: "prod-samsung-a14", sku: "SAM-A14", title: "Default" })
  data.offers.push({
    id: "offer-a14",
    sellerId: "seller-b",
    productId: "prod-samsung-a14",
    variantId: "var-a14",
    pricePesewas: 2000n,
    onHand: 5,
    reserved: 0,
    currency: "ghs",
    active: true,
    condition: "new",
  })
  // Tecno fixture: brand + typed storage value.
  const tecno = data.products.find((p) => p.id === "prod-tecno-spark")!
  tecno.brand = "Tecno"
  tecno.model = "Spark 20"
  tecno.identityConfidence = "identified"
  data.attributeDefinitions.push(
    {
      id: "def-storage",
      code: "phone.storage_gb",
      label: "Storage",
      type: "number",
      unitFamily: "storage",
      allowedValues: null,
      filterable: true,
      searchable: false,
      required: false,
      variantAxis: true,
      visibleOnCard: false,
      visibleOnPdp: true,
    },
    {
      id: "def-network",
      code: "phone.network",
      label: "Network",
      type: "option",
      allowedValues: ["4G", "5G"],
      filterable: true,
      searchable: false,
      required: false,
      variantAxis: true,
      visibleOnCard: false,
      visibleOnPdp: true,
    },
  )
  data.productAttributeValues.push(
    { id: "v1", productId: "prod-tecno-spark", definitionId: "def-storage", numberValue: 128, unit: "GB" },
    { id: "v2", productId: "prod-samsung-a14", definitionId: "def-storage", numberValue: 64, unit: "GB" },
    { id: "v3", productId: "prod-tecno-spark", definitionId: "def-network", optionValues: ["4G"] },
  )
  return data
}

function searchApp() {
  const repo = new InMemoryCatalogRepository(searchSnapshot())
  return { app: createApp({ repo }), repo }
}

function testEnv() {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars-long",
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

describe("GET /store/search", () => {
  it("ranks title matches above description-only matches", async () => {
    const { repo } = searchApp()
    const res = await repo.searchProducts({ q: "samsung", limit: 20, offset: 0 })
    expect(res.total).toBe(1)
    expect(res.items[0]!.productId).toBe("prod-samsung-a14")
  })

  it("matches brand/model identity fields", async () => {
    const { repo } = searchApp()
    const res = await repo.searchProducts({ q: "tecno spark", limit: 20, offset: 0 })
    expect(res.items.map((i) => i.productId)).toContain("prod-tecno-spark")
  })

  it("applies approved synonyms and surfaces provenance", async () => {
    const { repo } = searchApp()
    await repo.proposeSearchAlias("fons", "tecno", "synonym")
    const [pending] = await repo.listSearchAliases("proposed")
    // Unapproved aliases never rewrite queries.
    const before = await repo.searchProducts({ q: "fons", limit: 20, offset: 0 })
    expect(before.appliedAlias).toBeNull()
    await repo.reviewSearchAlias(pending!.id, "approved", "admin-1")
    const after = await repo.searchProducts({ q: "fons", limit: 20, offset: 0 })
    expect(after.appliedAlias).toEqual({ term: "fons", kind: "synonym" })
    expect(after.total).toBeGreaterThan(0)
  })

  it("returns redirects for redirect aliases without product results", async () => {
    const { repo } = searchApp()
    await repo.proposeSearchAlias("tecno store", "shops/seller-a", "redirect")
    const [pending] = await repo.listSearchAliases("proposed")
    await repo.reviewSearchAlias(pending!.id, "approved", "admin-1")
    const res = await repo.searchProducts({ q: "tecno store", limit: 20, offset: 0 })
    expect(res.redirect).toBe("shops/seller-a")
    expect(res.items).toEqual([])
  })

  it("filters by typed attribute values with server counts", async () => {
    const { repo } = searchApp()
    const res = await repo.searchProducts({
      q: "",
      limit: 20,
      offset: 0,
      filters: [{ code: "phone.storage_gb", values: ["128"] }],
    })
    expect(res.items.map((i) => i.productId)).toEqual(["prod-tecno-spark"])
    expect(res.facetDistribution["phone.storage_gb"]).toMatchObject({ "128 GB": 1 })
  })

  it("recovers honestly on zero results with suggestions", async () => {
    const { repo } = searchApp()
    const res = await repo.searchProducts({ q: "refrigerator xyz", limit: 20, offset: 0 })
    expect(res.total).toBe(0)
    expect(res.items).toEqual([])
    // No unrelated trending filler — suggestions are categories/shops only.
    expect(Object.keys(res.facetDistribution)).toEqual([])
  })

  it("400s unknown facet codes instead of silent empty pages", async () => {
    const { app } = searchApp()
    const res = await app.request("/store/search?q=phone&filter=nope%3Ax", {}, testEnv())
    expect(res.status).toBe(400)
  })

  it("logs zero-result queries for the quality queue", async () => {
    const { app, repo } = searchApp()
    const res = await app.request("/store/search?q=zzzznothing", {}, testEnv())
    expect(res.status).toBe(200)
    expect(((await res.json()) as { total: number }).total).toBe(0)
    const logged = await repo.listZeroResultQueries()
    expect(logged.map((q) => q.query)).toContain("zzzznothing")
  })
})

describe("GET /store/catalog/facets", () => {
  it("returns price bounds, availability, conditions, attribute counts", async () => {
    const { app } = searchApp()
    const res = await app.request("/store/catalog/facets", {}, testEnv())
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      priceMinPesewas: string
      priceMaxPesewas: string
      availabilityCount: number
      conditions: Record<string, number>
      attributes: Array<{ code: string; values: Record<string, number> }>
    }
    expect(body.priceMinPesewas).toBe("1500")
    expect(body.priceMaxPesewas).toBe("2000")
    expect(body.availabilityCount).toBe(2)
    expect(body.conditions).toMatchObject({ new: 1 })
    const storage = body.attributes.find((a) => a.code === "phone.storage_gb")
    expect(storage?.values).toMatchObject({ "128 GB": 1, "64 GB": 1 })
  })
})

describe("Phase 2A — outbox hooks", () => {
  it("records projection triggers on catalog writes", async () => {
    const { repo } = searchApp()
    const before = await repo.outboxStatus()
    await repo.proposeSearchAlias("fridge", "refrigerator", "synonym")
    const after = await repo.outboxStatus()
    expect(after.pending).toBe(before.pending + 1)
    expect(after.lastAt).toBeTruthy()
  })
})
