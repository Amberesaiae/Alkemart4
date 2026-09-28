import { hashPassword } from "@alkemart/domain"
import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import { createApp } from "../../index"
import { InMemoryListingReviewStore } from "../../listing-reviews"
import { signSessionJwt } from "../../lib/jwt"
import { resetRateLimits } from "../../middleware/security"

resetRateLimits()
const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"

function empty(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [], products: [], variants: [], offers: [], productOptions: [], productOptionValues: [], variantOptionValues: [],
    attributeDefinitions: [], attributeProfiles: [], profileAttributes: [], productAttributeValues: [], matchCandidates: [],
    searchAliases: [], verifications: [], priceHistory: [],
  }
}

const aiSaying = (verdict: string, confidence: number, reasons: unknown[] = []) => ({
  run: async () => ({ response: JSON.stringify({ verdict, confidence, reasons }) }),
})

async function setup(mode?: "trust" | "manual" | "assist" | "auto", ai?: ReturnType<typeof aiSaying>) {
  const authRepo = new InMemoryAuthRepository()
  const repo = new InMemoryCatalogRepository(empty())
  const reviews = new InMemoryListingReviewStore()
  if (mode) await reviews.setReviewMode(mode)
  const app = createApp({ authRepo, repo, jwtSecret: JWT, reviewStore: reviews })
  const env = { ENVIRONMENT: "development", ...(ai ? { AI: ai } : {}) }
  await authRepo.registerVendor({
    user: { id: "u1", email: "s@t.test", passwordHash: await hashPassword("VendorPass1") },
    seller: { id: "s1", handle: "s1", name: "Shop" },
  })
  await authRepo.updateSellerStatus("s1", "open")
  await authRepo.createUser({ id: "a1", email: "a@t.test", passwordHash: await hashPassword("AdminPass1"), role: "admin" })
  const seller = await signSessionJwt({ userId: "u1", role: "seller_member", sellerId: "s1" }, JWT)
  const admin = await signSessionJwt({ userId: "a1", role: "admin" }, JWT)
  const call = (path: string, token: string, method = "GET", body?: unknown) =>
    app.request(
      path,
      { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined },
      env,
    )
  const create = async (title: string) => {
    const r = await call("/vendor/products", seller, "POST", {
      title,
      description: "Brand new in the box, one year warranty.",
      primaryCategoryId: "phones",
      pricePesewas: "150000",
      onHand: 3,
      imageUrl: "https://example.com/p.jpg",
      draft: true,
    })
    return ((await r.json()) as { product: { id: string } }).product.id
  }
  const submit = async (id: string) =>
    (await (await call(`/vendor/products/${id}/propose`, seller, "POST")).json()) as {
      product: { status: string }
      review: { decision: string; reviewer: string; reasons: { code: string }[] } | null
    }
  return { call, create, submit, seller, admin }
}

describe("trust by default", () => {
  it("with no setting, a clean listing goes live the moment it's published — no AI needed", async () => {
    const t = await setup()
    expect(((await (await t.call("/admin/products/review-settings", t.admin)).json()) as { mode: string }).mode).toBe("trust")
    const out = await t.submit(await t.create("Tecno Spark 20 Pro 256GB Black"))
    expect(out.review).toMatchObject({ decision: "approve", reviewer: "system" })
    expect(out.product.status).toBe("published")
  })

  it("a flagged listing still waits for a person", async () => {
    const t = await setup()
    const out = await t.submit(await t.create("Rolex Submariner replica watch"))
    expect(out.review?.decision).toBe("escalate")
    expect(out.product.status).toBe("proposed")
  })

  it("editing a live listing doesn't take it off sale: a clean edit is back live at once", async () => {
    const t = await setup()
    const id = await t.create("Tecno Spark 20 Pro 256GB Black")
    await t.submit(id)
    const edited = await t.call(`/vendor/products/${id}`, t.seller, "PATCH", { title: "Tecno Spark 20 Pro 256GB Black (sealed)" })
    expect(edited.status).toBe(200)
    expect(((await edited.json()) as { product: { status: string } }).product.status).toBe("published")

    // An edit that trips a flag goes to the queue, like a new listing would.
    const risky = await t.call(`/vendor/products/${id}`, t.seller, "PATCH", { title: "Tecno Spark replica" })
    expect(((await risky.json()) as { product: { status: string } }).product.status).toBe("proposed")
  })
})

describe("listing review on submit", () => {
  it("contact details go straight back to the seller with the reason (any mode)", async () => {
    const t = await setup("auto", aiSaying("approve", 0.99))
    const out = await t.submit(await t.create("Tecno Spark 20 call 0241234567 now"))
    expect(out.review?.decision).toBe("request_changes")
    expect(out.review?.reasons.map((r) => r.code)).toContain("contact_details")
    const list = (await (await t.call("/vendor/products", t.seller)).json()) as { items: { review: { decision: string; by: string } }[] }
    expect(list.items[0]!.review).toMatchObject({ decision: "request_changes", by: "automatic check" })
  })

  it("auto mode: a clean listing the AI confidently approves goes live", async () => {
    const t = await setup("auto", aiSaying("approve", 0.95))
    const out = await t.submit(await t.create("Tecno Spark 20 Pro 256GB Black"))
    expect(out.review?.decision).toBe("approve")
    expect(out.product.status).toBe("published")
  })

  it("assist mode: AI advice is recorded but a human decides", async () => {
    const t = await setup("assist", aiSaying("approve", 0.95))
    const id = await t.create("Tecno Spark 20 Pro 256GB Black")
    const out = await t.submit(id)
    expect(out.review?.decision).toBe("escalate")
    expect(out.product.status).toBe("proposed")
    const hist = (await (await t.call(`/admin/products/${id}/reviews`, t.admin)).json()) as { reviews: { reviewer: string; model: string | null; confidence: number | null }[] }
    expect(hist.reviews[0]).toMatchObject({ reviewer: "ai", confidence: 0.95 })
    expect(hist.reviews[0]!.model).toBeTruthy()
  })

  it("no AI binding: rules only, then the admin queue", async () => {
    const t = await setup("auto")
    const out = await t.submit(await t.create("Tecno Spark 20 Pro 256GB Black"))
    expect(out.review?.decision).toBe("escalate")
    expect(out.review?.reviewer).toBe("system")
  })

  it("admin decision with reasons reaches the seller, and the mode switch is audited", async () => {
    const t = await setup("manual")
    const id = await t.create("Tecno Spark 20 Pro 256GB Black")
    await t.submit(id)
    const res = await t.call(`/admin/products/${id}/reject`, t.admin, "POST", {
      reasons: [{ code: "wrong_photo", message: "The photo shows a different phone. Upload a photo of this one." }],
      note: "Happy to approve once the photo matches.",
    })
    expect(res.status).toBe(200)
    const list = (await (await t.call("/vendor/products", t.seller)).json()) as {
      items: { review: { decision: string; by: string; reasons: { message: string }[]; note: string } }[]
    }
    expect(list.items[0]!.review).toMatchObject({ decision: "reject", by: "team", note: "Happy to approve once the photo matches." })
    expect(list.items[0]!.review.reasons[0]!.message).toContain("different phone")

    const put = await t.call("/admin/products/review-settings", t.admin, "PUT", { mode: "auto" })
    expect(put.status).toBe(200)
    expect(((await (await t.call("/admin/products/review-settings", t.admin)).json()) as { mode: string }).mode).toBe("auto")
  })
})
