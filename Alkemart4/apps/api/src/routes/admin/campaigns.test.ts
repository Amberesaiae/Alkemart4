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

async function setup() {
  const snapshot = demoCatalog()
  const repo = new InMemoryCatalogRepository(snapshot)
  // Campaign eligibility needs a product image; the seed leaves it unknown.
  const prod = repo.snapshot().products.find((p) => p.id === "prod-tecno-spark")!
  prod.imageUrl = "https://cdn.alkemart.test/tecno.jpg"
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const adminToken = await signSessionJwt({ userId: "admin-1", role: "admin" }, JWT)
  const app = createApp({ repo, authRepo, jwtSecret: JWT })
  const auth = (method = "GET") => ({
    method,
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
  })
  const post = (path: string, body: unknown) =>
    app.request(path, { ...auth("POST"), body: JSON.stringify(body) }, testEnv())
  const get = (path: string) => app.request(path, auth(), testEnv())
  return { app, repo, auth, post, get, adminToken }
}

const past = new Date(Date.now() - 3_600_000).toISOString()
const future = new Date(Date.now() + 86_400_000).toISOString()

type PostFn = (path: string, body: unknown) => Promise<Response> | Response

async function liveCampaign(
  post: PostFn,
  name: string,
  placementCode = "hero",
  priority = 0,
) {
  const created = await post("/admin/campaigns", {
    name,
    placementCode,
    priority,
    startsAt: past,
    endsAt: future,
  })
  expect(created.status).toBe(201)
  const id = ((await created.json()) as { campaign: { id: string } }).campaign.id
  const creative = await post(`/admin/campaigns/${id}/creatives`, {
    title: `${name} creative`,
    imageUrl: "https://cdn.alkemart.test/hero.jpg",
  })
  expect(creative.status).toBe(201)
  const set = await post(`/admin/campaigns/${id}/products`, { productIds: ["prod-tecno-spark"] })
  expect(set.status).toBe(200)
  for (const action of ["submit", "approve", "publish"]) {
    const moved = await post(`/admin/campaigns/${id}/transitions`, { action })
    expect(moved.status).toBe(200)
  }
  return id
}

describe("admin campaigns (Phase 5A)", () => {
  it("lists seeded placements and validates creation", async () => {
    const { get, post } = await setup()
    const placements = await get("/admin/campaigns/placements")
    expect(placements.status).toBe(200)
    const codes = ((await placements.json()) as { items: { code: string }[] }).items.map((p) => p.code)
    expect(codes).toEqual(["hero", "deal_rail", "promo_grid", "promo_band", "marquee"])

    const badPlacement = await post("/admin/campaigns", { name: "X", placementCode: "nope" })
    expect(badPlacement.status).toBe(400)
    const badWindow = await post("/admin/campaigns", {
      name: "X",
      placementCode: "hero",
      startsAt: future,
      endsAt: past,
    })
    expect(badWindow.status).toBe(400)
  })

  it("gates publishing on review, schedule, products, and creatives", async () => {
    const { post, get, app, auth } = await setup()
    const created = await post("/admin/campaigns", { name: "Gate", placementCode: "hero" })
    const id = ((await created.json()) as { campaign: { id: string } }).campaign.id

    const earlyPublish = await post(`/admin/campaigns/${id}/transitions`, { action: "publish" })
    expect(earlyPublish.status).toBe(400)
    await post(`/admin/campaigns/${id}/transitions`, { action: "submit" })
    const noSchedule = await post(`/admin/campaigns/${id}/transitions`, { action: "approve" })
    expect(noSchedule.status).toBe(400)

    const second = await post("/admin/campaigns", {
      name: "Gate2",
      placementCode: "hero",
      startsAt: past,
      endsAt: future,
    })
    const id2 = ((await second.json()) as { campaign: { id: string } }).campaign.id
    await post(`/admin/campaigns/${id2}/transitions`, { action: "submit" })
    await post(`/admin/campaigns/${id2}/transitions`, { action: "approve" })
    const noAssets = await post(`/admin/campaigns/${id2}/transitions`, { action: "publish" })
    expect(noAssets.status).toBe(400)

    const detail = await get(`/admin/campaigns/${id2}`)
    expect(detail.status).toBe(200)
    const audit = ((await detail.json()) as { audit: { action: string }[] }).audit.map((a) => a.action)
    expect(audit).toEqual(expect.arrayContaining(["create", "submit", "approve"]))

    // Drafts delete; scheduled campaigns must end instead.
    const live = await post("/admin/campaigns", { name: "Gate3", placementCode: "hero" })
    const id3 = ((await live.json()) as { campaign: { id: string } }).campaign.id
    const delDraft = await app.request(`/admin/campaigns/${id3}`, { ...auth("DELETE") }, testEnv())
    expect(delDraft.status).toBe(200)
    const delScheduled = await app.request(`/admin/campaigns/${id2}`, { ...auth("DELETE") }, testEnv())
    expect(delScheduled.status).toBe(400)
  })

  it("resolves conflicts by priority and auto-expires", async () => {
    const { post, get, app, repo } = await setup()
    await liveCampaign(post, "Low", "hero", 1)
    const high = await liveCampaign(post, "High", "hero", 9)

    const course = await app.request("/store/course", {}, testEnv())
    expect(course.status).toBe(200)
    const body = (await course.json()) as {
      placements: { code: string; campaigns: { id: string; name: string; products: { productId: string }[] }[] }[]
    }
    const hero = body.placements.find((p) => p.code === "hero")!
    expect(hero.campaigns.map((c) => c.id)).toEqual([high])
    expect(hero.campaigns[0]!.products.map((p) => p.productId)).toContain("prod-tecno-spark")

    // Promo grid takes two winners by priority order (min 2 products each).
    repo.snapshot().products.push({
      id: "prod-second",
      title: "Second Phone",
      description: null,
      status: "published",
      primaryCategoryId: "phones",
      sellerId: "seller-a",
      imageUrl: "https://cdn.alkemart.test/second.jpg",
      attributes: [],
      brand: null,
      model: null,
      gtin: null,
      mpn: null,
      manufacturer: null,
      productType: null,
      identityConfidence: "seller_specific",
    })
    repo.snapshot().variants.push({ id: "var-second", productId: "prod-second", sku: null, title: "Default" })
    repo.snapshot().offers.push({
      id: "offer-second",
      sellerId: "seller-a",
      productId: "prod-second",
      variantId: "var-second",
      pricePesewas: 20000n,
      onHand: 2,
      reserved: 0,
      currency: "GHS",
      active: true,
    })
    const g1 = await liveCampaign(post, "Grid A", "promo_grid", 1)
    const g2 = await liveCampaign(post, "Grid B", "promo_grid", 2)
    for (const gid of [g1, g2]) {
      // Live campaigns accept new set versions; the course re-checks.
      const set = await post(`/admin/campaigns/${gid}/products`, {
        productIds: ["prod-tecno-spark", "prod-second"],
      })
      expect(set.status).toBe(200)
    }
    const course2 = (await (await app.request("/store/course", {}, testEnv())).json()) as typeof body
    expect(course2.placements.find((p) => p.code === "promo_grid")!.campaigns.map((c) => c.id)).toEqual([g2, g1])

    // Expired campaigns fall offline on read.
    const exp = await post("/admin/campaigns", {
      name: "Expired",
      placementCode: "marquee",
      startsAt: new Date(Date.now() - 172_800_000).toISOString(),
      endsAt: new Date(Date.now() - 86_400_000).toISOString(),
    })
    const expId = ((await exp.json()) as { campaign: { id: string } }).campaign.id
    await post(`/admin/campaigns/${expId}/creatives`, { title: "E" })
    await post(`/admin/campaigns/${expId}/products`, { productIds: ["prod-tecno-spark"] })
    await post(`/admin/campaigns/${expId}/transitions`, { action: "submit" })
    await post(`/admin/campaigns/${expId}/transitions`, { action: "approve" })
    const pub = await post(`/admin/campaigns/${expId}/transitions`, { action: "publish" })
    expect(pub.status).toBe(200)
    await app.request("/store/course", {}, testEnv())
    const after = await get(`/admin/campaigns/${expId}`)
    expect(((await after.json()) as { campaign: { status: string } }).campaign.status).toBe("ended")
    const course3 = (await (await app.request("/store/course", {}, testEnv())).json()) as typeof body
    expect(course3.placements.find((p) => p.code === "marquee")!.campaigns).toEqual([])
  })

  it("excludes ineligible products and counts promotion events", async () => {
    const { post, repo, app, adminToken, auth } = await setup()
    // A published product with no image can never ride a campaign.
    repo.snapshot().products.push({
      id: "prod-noimg",
      title: "No Image Item",
      description: null,
      status: "published",
      primaryCategoryId: "phones",
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
    })
    repo.snapshot().variants.push({ id: "var-noimg", productId: "prod-noimg", sku: null, title: "Default" })
    repo.snapshot().offers.push({
      id: "offer-noimg",
      sellerId: "seller-a",
      productId: "prod-noimg",
      variantId: "var-noimg",
      pricePesewas: 5000n,
      onHand: 3,
      reserved: 0,
      currency: "GHS",
      active: true,
    })
    const id = await liveCampaign(post, "Mixed", "hero", 0)
    const set = await post(`/admin/campaigns/${id}/products`, { productIds: ["prod-tecno-spark", "prod-noimg"] })
    // Live campaigns accept new set versions; eligibility filters at serve time.
    expect([200, 400].includes(set.status)).toBe(true)

    const course = (await (await app.request("/store/course", {}, testEnv())).json()) as {
      placements: { code: string; campaigns: { id: string; products: { productId: string }[] }[] }[]
    }
    const products = course.placements.find((p) => p.code === "hero")!.campaigns[0]!.products.map((p) => p.productId)
    expect(products).toContain("prod-tecno-spark")
    expect(products).not.toContain("prod-noimg")

    // Attribution: views and selects aggregate per campaign.
    const campaignId = course.placements.find((p) => p.code === "hero")!.campaigns[0]!.id
    const bad = await app.request("/store/course/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: "x", placementCode: "hero", event: "bogus" }),
    }, testEnv())
    expect(bad.status).toBe(400)
    const ghost = await app.request("/store/course/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: "nope", placementCode: "hero", event: "view" }),
    }, testEnv())
    expect(ghost.status).toBe(202)
    for (const event of ["view", "view", "select"]) {
      await app.request("/store/course/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaignId, placementCode: "hero", event }),
      }, testEnv())
    }
    const report = await app.request(`/admin/campaigns/${campaignId}/report`, auth(), testEnv())
    expect(report.status).toBe(200)
    expect(await report.json()).toMatchObject({ views: 2, selects: 1 })
  })
})
