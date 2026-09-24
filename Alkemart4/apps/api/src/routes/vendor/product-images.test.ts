import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
resetRateLimits()

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"
const IMG = (n: number) => `https://cdn.example.com/p${n}.jpg`

function testEnv(): ApiEnv {
  const store = new Map<string, string>()
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {
      get: (async (k: string) => store.get(k) ?? null) as KVNamespace["get"],
      put: (async (k: string, v: string) => { store.set(k, v) }) as KVNamespace["put"],
    } as KVNamespace,
  }
}

function json(method: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method, headers, body: JSON.stringify(body) }
}

function emptySnapshot(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [
      { id: "seller-1", handle: "gallery-shop", name: "Gallery Shop", status: "open", commissionBps: 700, deliveryFeePesewas: 0n, availability: "open", pausedUntil: null, pauseNote: null },
      { id: "seller-2", handle: "other-shop", name: "Other Shop", status: "open", commissionBps: 700, deliveryFeePesewas: 0n, availability: "open", pausedUntil: null, pauseNote: null },
    ],
    products: [], variants: [], offers: [],
    productOptions: [], productOptionValues: [], variantOptionValues: [],
    attributeDefinitions: [], attributeProfiles: [], profileAttributes: [],
    productAttributeValues: [], matchCandidates: [], searchAliases: [],
    verifications: [], priceHistory: [],
  }
}

async function setup() {
  const snapshot = emptySnapshot()
  const authRepo = new InMemoryAuthRepository()
  const { hashPassword } = await import("@alkemart/domain")
  for (const [i, email] of ["a@alkemart.test", "b@alkemart.test"].entries()) {
    await authRepo.registerVendor({
      user: { id: `u${i + 1}`, email, passwordHash: await hashPassword("VendorPass1") },
      seller: { id: `seller-${i + 1}`, handle: i === 0 ? "gallery-shop" : "other-shop", name: "S" },
    })
    await authRepo.updateSellerStatus(`seller-${i + 1}`, "open")
  }
  const app = createApp({
    authRepo,
    repo: new InMemoryCatalogRepository(snapshot),
    checkoutRepo: new InMemoryCheckoutRepository(snapshot),
    jwtSecret: JWT_SECRET,
  })
  const login = async (email: string) => {
    const res = await app.request("/vendor/auth/login", json("POST", { email, password: "VendorPass1" }), testEnv())
    expect(res.status).toBe(200)
    return ((await res.json()) as { token: string }).token
  }
  return { app, tokenA: await login("a@alkemart.test"), tokenB: await login("b@alkemart.test") }
}

async function createProduct(app: ReturnType<typeof createApp>, token: string, imageUrl?: string) {
  const res = await app.request(
    "/vendor/products",
    json("POST", {
      title: "Kente Cloth", primaryCategoryId: "women",
      pricePesewas: "10000", onHand: 4,
      ...(imageUrl ? { imageUrl } : {}),
    }, token),
    testEnv(),
  )
  expect(res.status).toBe(201)
  return ((await res.json()) as { product: { id: string } }).product.id
}

const put = (app: ReturnType<typeof createApp>, id: string, token: string, images: unknown[]) =>
  app.request(`/vendor/products/${id}/images`, json("PUT", { images }, token), testEnv())

describe("PUT /vendor/products/:id/images", () => {
  it("stores a gallery and serves it on the buyer-facing detail, primary first", async () => {
    const { app, tokenA } = await setup()
    const id = await createProduct(app, tokenA, IMG(0))
    expect((await put(app, id, tokenA, [{ url: IMG(1) }, { url: IMG(2), alt: "Back" }])).status).toBe(200)

    const detail = await app.request(`/store/products/${id}`, {}, testEnv())
    expect(detail.status).toBe(200)
    const body = (await detail.json()) as { imageUrls: string[] }
    // products.imageUrl stays the primary; the gallery follows in array order.
    expect(body.imageUrls).toEqual([IMG(0), IMG(1), IMG(2)])
  })

  it("never duplicates the primary image when it also appears in the gallery", async () => {
    const { app, tokenA } = await setup()
    const id = await createProduct(app, tokenA, IMG(0))
    await put(app, id, tokenA, [{ url: IMG(0) }, { url: IMG(1) }])
    const body = (await (await app.request(`/store/products/${id}`, {}, testEnv())).json()) as { imageUrls: string[] }
    expect(body.imageUrls).toEqual([IMG(0), IMG(1)])
  })

  it("replaces the gallery wholesale, so a reorder is the same call", async () => {
    const { app, tokenA } = await setup()
    const id = await createProduct(app, tokenA)
    await put(app, id, tokenA, [{ url: IMG(1) }, { url: IMG(2) }])
    await put(app, id, tokenA, [{ url: IMG(2) }, { url: IMG(1) }])
    const body = (await (await app.request(`/store/products/${id}`, {}, testEnv())).json()) as { imageUrls: string[] }
    expect(body.imageUrls).toEqual([IMG(2), IMG(1)])
  })

  it("clears the gallery with an empty array, leaving the legacy single image", async () => {
    const { app, tokenA } = await setup()
    const id = await createProduct(app, tokenA, IMG(0))
    await put(app, id, tokenA, [{ url: IMG(1) }])
    await put(app, id, tokenA, [])
    const body = (await (await app.request(`/store/products/${id}`, {}, testEnv())).json()) as { imageUrls: string[] }
    expect(body.imageUrls).toEqual([IMG(0)])
  })

  it("rejects duplicate urls, over-long galleries and non-http urls", async () => {
    const { app, tokenA } = await setup()
    const id = await createProduct(app, tokenA)
    expect((await put(app, id, tokenA, [{ url: IMG(1) }, { url: IMG(1) }])).status).toBe(400)
    expect((await put(app, id, tokenA, Array.from({ length: 11 }, (_, i) => ({ url: IMG(i) })))).status).toBe(400)
    expect((await put(app, id, tokenA, [{ url: "ftp://x/y.jpg" }])).status).toBe(400)
  })

  it("returns the gallery on the vendor DTO so the editor can read it back", async () => {
    const { app, tokenA } = await setup()
    const id = await createProduct(app, tokenA)
    const res = await put(app, id, tokenA, [{ url: IMG(1), alt: "Front" }, { url: IMG(2) }])
    const body = (await res.json()) as { images: { url: string; alt: string | null }[] }
    expect(body.images).toEqual([
      { url: IMG(1), alt: "Front" },
      { url: IMG(2), alt: null },
    ])
  })

  it("404s for another seller's product and 401s without a token", async () => {
    const { app, tokenA, tokenB } = await setup()
    const id = await createProduct(app, tokenA)
    expect((await put(app, id, tokenB, [{ url: IMG(1) }])).status).toBe(404)
    const anon = await app.request(`/vendor/products/${id}/images`, json("PUT", { images: [] }), testEnv())
    expect(anon.status).toBe(401)
  })
})
