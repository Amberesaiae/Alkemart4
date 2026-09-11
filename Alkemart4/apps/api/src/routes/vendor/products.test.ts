import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv() {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function emptyCatalog(): CatalogSnapshot {
  return {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [],
    products: [],
    variants: [],
    offers: [],
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
  }
}

async function registerVendor(
  app: ReturnType<typeof createApp>,
  input: { email: string; sellerName: string; sellerHandle: string },
) {
  const res = await app.request("/vendor/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password: "VendorPass1",
      sellerName: input.sellerName,
      sellerHandle: input.sellerHandle,
    }),
  }, testEnv())
  const body = (await res.json()) as { token: string; user: { sellerId: string } }
  expect(res.status).toBe(201)
  return { token: body.token, sellerId: body.user.sellerId }
}

function authJson(method: string, token: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  return {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }
}

const createBody = {
  title: "Tecno Spark 20",
  description: "Budget Android",
  primaryCategoryId: "phones",
  pricePesewas: "159900",
  onHand: 3,
}

describe("vendor product isolation", () => {
  it("seller A cannot PATCH seller B's product or offer", async () => {
    const authRepo = new InMemoryAuthRepository()
    const repo = new InMemoryCatalogRepository(emptyCatalog())
    const app = createApp({ authRepo, repo, jwtSecret: JWT_SECRET })

    const sellerA = await registerVendor(app, {
      email: "a@alkemart.test",
      sellerName: "Shop A",
      sellerHandle: "shop-a",
    })
    const sellerB = await registerVendor(app, {
      email: "b@alkemart.test",
      sellerName: "Shop B",
      sellerHandle: "shop-b",
    })

    const created = await app.request(
      "/vendor/products",
      authJson("POST", sellerB.token, createBody),
    testEnv())
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as { product: { id: string } }
    const productId = createdBody.product.id

    const patch = await app.request(
      `/vendor/products/${productId}`,
      authJson("PATCH", sellerA.token, {
        title: "Hijacked title",
        pricePesewas: "1",
      }),
    testEnv())
    expect(patch.status).toBe(404)

    const listA = await app.request("/vendor/products", authJson("GET", sellerA.token), testEnv())
    expect(listA.status).toBe(200)
    const listABody = (await listA.json()) as { items: unknown[] }
    expect(listABody.items).toEqual([])

    const listB = await app.request("/vendor/products", authJson("GET", sellerB.token), testEnv())
    const listBBody = (await listB.json()) as {
      items: Array<{ product: { title: string }; offer: { pricePesewas: string } }>
    }
    expect(listBBody.items).toHaveLength(1)
    expect(listBBody.items[0]!.product.title).toBe("Tecno Spark 20")
    expect(listBBody.items[0]!.offer.pricePesewas).toBe("159900")
  })
})

describe("POST /vendor/products", () => {
  it("creates a proposed product + offer for the auth seller with leaf category", async () => {
    const authRepo = new InMemoryAuthRepository()
    const repo = new InMemoryCatalogRepository(emptyCatalog())
    const app = createApp({ authRepo, repo, jwtSecret: JWT_SECRET })
    const seller = await registerVendor(app, {
      email: "ama@alkemart.test",
      sellerName: "Ama Shop",
      sellerHandle: "ama-shop",
    })

    const res = await app.request("/vendor/products", authJson("POST", seller.token, createBody), testEnv())
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      product: {
        id: string
        title: string
        status: string
        primaryCategoryId: string
        sellerId: string
      }
      offer: { sellerId: string; pricePesewas: string; onHand: number; currency: string }
      variant: { id: string }
    }
    expect(body.product.status).toBe("proposed")
    expect(body.product.primaryCategoryId).toBe("phones")
    expect(body.product.sellerId).toBe(seller.sellerId)
    expect(body.offer.sellerId).toBe(seller.sellerId)
    expect(body.offer.pricePesewas).toBe("159900")
    expect(body.offer.onHand).toBe(3)
    expect(body.offer.currency).toBe("ghs")
    expect(body.variant.id).toBeTruthy()
  })

  it("rejects non-leaf primaryCategoryId", async () => {
    const authRepo = new InMemoryAuthRepository()
    const repo = new InMemoryCatalogRepository(emptyCatalog())
    const app = createApp({ authRepo, repo, jwtSecret: JWT_SECRET })
    const seller = await registerVendor(app, {
      email: "leaf@alkemart.test",
      sellerName: "Leaf Shop",
      sellerHandle: "leaf-shop",
    })

    const res = await app.request(
      "/vendor/products",
      authJson("POST", seller.token, {
        ...createBody,
        primaryCategoryId: "phones-electronics",
      }),
    testEnv())
    expect(res.status).toBe(400)
  })
})

describe("POST /vendor/products/:id/propose", () => {
  it("owner can propose; seller A cannot propose seller B's product", async () => {
    const authRepo = new InMemoryAuthRepository()
    const repo = new InMemoryCatalogRepository(emptyCatalog())
    const app = createApp({ authRepo, repo, jwtSecret: JWT_SECRET })
    const sellerA = await registerVendor(app, {
      email: "a-prop@alkemart.test",
      sellerName: "A Prop",
      sellerHandle: "a-prop",
    })
    const sellerB = await registerVendor(app, {
      email: "b-prop@alkemart.test",
      sellerName: "B Prop",
      sellerHandle: "b-prop",
    })

    const created = await app.request(
      "/vendor/products",
      authJson("POST", sellerB.token, createBody),
    testEnv())
    const { product } = (await created.json()) as { product: { id: string } }

    const own = await app.request(
      `/vendor/products/${product.id}/propose`,
      authJson("POST", sellerB.token),
    testEnv())
    expect(own.status).toBe(200)
    expect(((await own.json()) as { product: { status: string } }).product.status).toBe(
      "proposed",
    )

    const cross = await app.request(
      `/vendor/products/${product.id}/propose`,
      authJson("POST", sellerA.token),
    testEnv())
    expect(cross.status).toBe(404)
  })
})
