import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it, vi } from "vitest"
import { InMemoryAuthRepository } from "../auth-repository"
import { InMemoryCatalogRepository } from "../catalog-repository"
import type { CatalogSnapshot } from "../demo-seed"
import { createApp } from "../index"
import { signSessionJwt } from "./jwt"
import { mediaBase, variantKeys } from "./media-cleanup"

const JWT = "test-jwt-secret-that-is-at-least-32-chars-long"
const API = "http://api.test/media/products"
const photo = (owner: string, id: string) => `${API}/${owner}/${id}.webp`

function empty(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [], products: [], variants: [], offers: [], productOptions: [], productOptionValues: [], variantOptionValues: [],
    attributeDefinitions: [], attributeProfiles: [], profileAttributes: [], productAttributeValues: [], matchCandidates: [],
    searchAliases: [], verifications: [], priceHistory: [],
  }
}

async function setup() {
  const authRepo = new InMemoryAuthRepository()
  const app = createApp({ authRepo, repo: new InMemoryCatalogRepository(empty()), jwtSecret: JWT })
  await authRepo.registerVendor({ user: { id: "u1", email: "s@t.test", passwordHash: await hashPassword("VendorPass1") }, seller: { id: "s1", handle: "s1", name: "Shop" } })
  await authRepo.updateSellerStatus("s1", "open")
  const deleted: string[] = []
  const env = { ENVIRONMENT: "development", MEDIA_BUCKET: { delete: async (keys: string | string[]) => void deleted.push(...[keys].flat()) } }
  const token = await signSessionJwt({ userId: "u1", role: "seller_member", sellerId: "s1" }, JWT)
  const call = (path: string, method = "GET", body?: unknown) =>
    app.request(path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }, env)
  const create = async (imageUrl: string) =>
    ((await (await call("/vendor/products", "POST", { title: "Kente", primaryCategoryId: "phones", pricePesewas: "10000", onHand: 2, imageUrl, draft: true })).json()) as { product: { id: string } }).product.id
  return { call, create, deleted, authRepo }
}

describe("mediaBase", () => {
  it("reads our /media keys and public-domain keys; ignores everything else", () => {
    expect(mediaBase(`${API}/s1/abc.thumb.webp`)).toEqual({ base: "products/s1/abc", kind: "products", owner: "s1" })
    expect(mediaBase("https://media.example/logos/s1/xyz.png", "https://media.example")).toEqual({ base: "logos/s1/xyz", kind: "logos", owner: "s1" })
    expect(mediaBase("https://cdn.example.com/p.jpg")).toBeNull()
    expect(variantKeys("products/s1/abc")).toContain("products/s1/abc.thumb.webp")
  })
})

describe("removed photos are deleted from storage", () => {
  it("deletes a dropped photo's files, but never one still used or another seller's", async () => {
    const t = await setup()
    const shared = photo("s1", "shared")
    const a = await t.create(photo("s1", "cover"))
    await t.create(shared) // another listing keeps using `shared`
    await t.call(`/vendor/products/${a}/images`, "PUT", { images: [{ url: photo("s1", "cover") }, { url: photo("s1", "gone") }, { url: shared }, { url: photo("s2", "theirs") }] })
    // Drop three: one only this listing used, one another listing uses, one that isn't ours.
    await t.call(`/vendor/products/${a}/images`, "PUT", { images: [{ url: photo("s1", "cover") }] })
    await vi.waitFor(() => expect(t.deleted).toEqual(variantKeys("products/s1/gone")))
  })

  it("deleting a listing deletes its photos", async () => {
    const t = await setup()
    const id = await t.create(photo("s1", "only"))
    expect((await t.call(`/vendor/products/${id}`, "DELETE")).status).toBe(200)
    await vi.waitFor(() => expect(t.deleted).toEqual(variantKeys("products/s1/only")))
  })

  it("a replaced shop logo is deleted; a pasted URL is left alone", async () => {
    const t = await setup()
    await t.call("/vendor/sellers/me", "POST", { logo: "http://api.test/media/logos/s1/old.png" })
    await t.call("/vendor/sellers/me", "POST", { logo: "http://api.test/media/logos/s1/new.png" })
    expect(t.deleted).toEqual(variantKeys("logos/s1/old"))
    await t.call("/vendor/sellers/me", "POST", { logo: "https://cdn.example.com/brand.png" })
    await t.call("/vendor/sellers/me", "POST", { logo: "https://cdn.example.com/brand2.png" })
    expect(t.deleted).toEqual([...variantKeys("logos/s1/old"), ...variantKeys("logos/s1/new")])
  })
})
