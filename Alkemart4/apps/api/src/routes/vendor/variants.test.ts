import { hashPassword } from "@alkemart/domain"
import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import { InMemoryCheckoutRepository } from "../../checkout-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import type { ApiEnv } from "../../env"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function testEnv(): ApiEnv {
  return {
    ENVIRONMENT: "development",
    JWT_SECRET,
    HYPERDRIVE: { connectionString: "postgres://x" },
    HYPERDRIVE_PRIMARY: { connectionString: "postgres://x" },
    CATALOG_KV: {} as KVNamespace,
  }
}

function json(method: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`
  return { method, headers, body: JSON.stringify(body) }
}

async function setup() {
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const snapshot: CatalogSnapshot = {
    categories: GHANA_CATEGORY_SEED.map((c) => ({ ...c })),
    sellers: [],
    products: [],
    variants: [],
    offers: [],
    productOptions: [],
    productOptionValues: [],
    variantOptionValues: [],
  }
  const app = createApp({
    authRepo,
    repo: new InMemoryCatalogRepository(snapshot),
    checkoutRepo: new InMemoryCheckoutRepository(snapshot),
    jwtSecret: JWT_SECRET,
  })
  const vendor = await app.request(
    "/vendor/auth/register",
    json("POST", {
      email: "variants@alkemart.test",
      password: "VendorPass1",
      sellerName: "Variant Shop",
      sellerHandle: "variant-shop",
    }),
    testEnv(),
  )
  expect(vendor.status).toBe(201)
  const sellerToken = ((await vendor.json()) as { token: string }).token
  const adminLogin = await app.request(
    "/admin/auth/login",
    json("POST", { email: "admin@alkemart.test", password: "AdminPass1" }),
    testEnv(),
  )
  const adminToken = ((await adminLogin.json()) as { token: string }).token
  return { app, sellerToken, adminToken }
}

const MATRIX = {
  title: "Ankara Gown",
  primaryCategoryId: "women",
  pricePesewas: "50000",
  onHand: 10,
  variant_options: [
    { name: "Size", values: ["S", "M"] },
    { name: "Colour", values: ["Red", "Navy"] },
  ],
  variant_entries: [{ options: { Size: "M", Colour: "Navy" }, pricePesewas: "55000", quantity: 3 }],
}

type FullProduct = {
  product: { id: string; status: string }
  options: { id: string; name: string; values: { id: string; value: string }[] }[]
  variants: {
    variant: { id: string; sku: string | null; title: string }
    offer: { pricePesewas: string; onHand: number; active: boolean }
    options: Record<string, string>
  }[]
}

describe("POST /vendor/products with variant_options", () => {
  it("builds the full matrix with per-entry overrides", async () => {
    const { app, sellerToken } = await setup()
    const res = await app.request("/vendor/products", json("POST", MATRIX, sellerToken), testEnv())
    expect(res.status).toBe(201)
    const body = (await res.json()) as FullProduct
    expect(body.options.map((o) => o.name)).toEqual(["Size", "Colour"])
    expect(body.variants).toHaveLength(4)
    expect(body.variants[0]!.variant.title).toBe("S / Red")
    expect(body.variants[0]!.variant.sku).toMatch(/^v-/)
    const navy = body.variants.find((v) => v.options.Size === "M" && v.options.Colour === "Navy")!
    expect(navy.offer.pricePesewas).toBe("55000")
    expect(navy.offer.onHand).toBe(3)
    const plain = body.variants.find((v) => v.options.Size === "S" && v.options.Colour === "Red")!
    expect(plain.offer.pricePesewas).toBe("50000")
    expect(plain.offer.onHand).toBe(10)
  })

  it("400s on 3 option types, oversize matrices, and unmatched entries", async () => {
    const { app, sellerToken } = await setup()
    const three = await app.request(
      "/vendor/products",
      json("POST", { ...MATRIX, variant_options: [...MATRIX.variant_options, { name: "Fit", values: ["Slim"] }] }, sellerToken),
      testEnv(),
    )
    expect(three.status).toBe(400)
    const big = await app.request(
      "/vendor/products",
      json("POST", {
        ...MATRIX,
        variant_options: [
          { name: "Size", values: ["1", "2", "3", "4", "5", "6"] },
          { name: "Colour", values: ["a", "b", "c", "d", "e", "f"] },
        ],
      }, sellerToken),
      testEnv(),
    )
    expect(big.status).toBe(400)
    const typo = await app.request(
      "/vendor/products",
      json("POST", { ...MATRIX, variant_entries: [{ options: { Size: "XXL", Colour: "Red" } }] }, sellerToken),
      testEnv(),
    )
    expect(typo.status).toBe(400)
  })
})

describe("PATCH /vendor/products/:id/variants/:variantId", () => {
  it("edits one combo without re-review; product-level price edits 400", async () => {
    const { app, sellerToken, adminToken } = await setup()
    const created = await app.request("/vendor/products", json("POST", MATRIX, sellerToken), testEnv())
    const body = (await created.json()) as FullProduct
    const productId = body.product.id
    await app.request(`/admin/products/${productId}/approve`, json("POST", {}, adminToken), testEnv())

    const target = body.variants[0]!
    const patched = await app.request(
      `/vendor/products/${productId}/variants/${target.variant.id}`,
      json("PATCH", { pricePesewas: "60000", onHand: 2 }, sellerToken),
      testEnv(),
    )
    expect(patched.status).toBe(200)
    const after = (await patched.json()) as FullProduct
    expect(after.product.status).toBe("published")
    expect(after.variants.find((v) => v.variant.id === target.variant.id)!.offer.pricePesewas).toBe("60000")

    const archived = await app.request(
      `/vendor/products/${productId}/variants/${target.variant.id}`,
      json("PATCH", { active: false }, sellerToken),
      testEnv(),
    )
    expect(archived.status).toBe(200)
    expect(
      ((await archived.json()) as FullProduct).variants.find((v) => v.variant.id === target.variant.id)!.offer.active,
    ).toBe(false)

    const blocked = await app.request(
      `/vendor/products/${productId}`,
      json("PATCH", { pricePesewas: "99999" }, sellerToken),
      testEnv(),
    )
    expect(blocked.status).toBe(400)
  })
})

describe("POST /vendor/products/:id/options", () => {
  it("adds values, stays idempotent, and re-reviews published listings", async () => {
    const { app, sellerToken, adminToken } = await setup()
    const created = await app.request(
      "/vendor/products",
      json("POST", {
        title: "Kente Scarf",
        primaryCategoryId: "women",
        pricePesewas: "20000",
        onHand: 5,
        variant_options: [{ name: "Colour", values: ["Red"] }],
      }, sellerToken),
      testEnv(),
    )
    const createdBody = (await created.json()) as FullProduct
    const productId = createdBody.product.id
    expect(createdBody.options.map((o) => o.name)).toEqual(["Colour"])
    await app.request(`/admin/products/${productId}/approve`, json("POST", {}, adminToken), testEnv())

    const added = await app.request(
      `/vendor/products/${productId}/options`,
      json("POST", { optionName: "Colour", value: "Navy" }, sellerToken),
      testEnv(),
    )
    expect(added.status).toBe(200)
    const grown = (await added.json()) as FullProduct
    expect(grown.variants).toHaveLength(2)
    expect(grown.product.status).toBe("proposed")
    const navy = grown.variants.find((v) => v.options.Colour === "Navy")!
    expect(navy.offer.onHand).toBe(0)
    expect(navy.offer.pricePesewas).toBe("20000")

    const again = await app.request(
      `/vendor/products/${productId}/options`,
      json("POST", { optionName: "Colour", value: "navy" }, sellerToken),
      testEnv(),
    )
    expect(again.status).toBe(200)
    expect(((await again.json()) as FullProduct).variants).toHaveLength(2)
  })

  it("introduces a first option type on legacy products", async () => {
    const { app, sellerToken } = await setup()
    const created = await app.request(
      "/vendor/products",
      json("POST", { title: "Shea Butter", primaryCategoryId: "health-beauty", pricePesewas: "15000", onHand: 8 }, sellerToken),
      testEnv(),
    )
    const productId = ((await created.json()) as FullProduct).product.id
    const typed = await app.request(
      `/vendor/products/${productId}/options`,
      json("POST", { optionName: "Pack", value: "Family", existingValue: "Single" }, sellerToken),
      testEnv(),
    )
    expect(typed.status).toBe(200)
    const body = (await typed.json()) as FullProduct
    expect(body.options.map((o) => o.name)).toEqual(["Pack"])
    expect(body.variants).toHaveLength(2)
    expect(body.variants.find((v) => v.options.Pack === "Single")!.offer.onHand).toBe(8)
  })
})
