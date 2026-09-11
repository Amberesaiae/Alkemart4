import { GHANA_CATEGORY_SEED } from "@alkemart/db"
import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { InMemoryCatalogRepository } from "../../catalog-repository"
import type { CatalogSnapshot } from "../../demo-seed"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

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

async function adminProductApp() {
  const authRepo = new InMemoryAuthRepository()
  const repo = new InMemoryCatalogRepository(emptyCatalog())
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const app = createApp({ authRepo, repo, jwtSecret: JWT_SECRET })

  const login = await app.request("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
  })
  expect(login.status).toBe(200)
  const { token: adminToken } = (await login.json()) as { token: string }

  const vendor = await app.request("/vendor/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "seller@alkemart.test",
      password: "VendorPass1",
      sellerName: "Ama Shop",
      sellerHandle: "ama-shop",
    }),
  })
  expect(vendor.status).toBe(201)
  const { token: sellerToken } = (await vendor.json()) as { token: string }

  const created = await app.request("/vendor/products", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Tecno Spark 20",
      description: "Budget Android",
      primaryCategoryId: "phones",
      pricePesewas: "159900",
      onHand: 3,
    }),
  })
  expect(created.status).toBe(201)
  const createdBody = (await created.json()) as {
    product: { id: string; status: string }
  }
  expect(createdBody.product.status).toBe("proposed")

  return { app, adminToken, productId: createdBody.product.id }
}

describe("GET /admin/products", () => {
  it("enriches items with the seller name and handle", async () => {
    const { app, adminToken } = await adminProductApp()
    const res = await app.request("/admin/products?status=proposed", {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      items: { title: string; sellerName: string | null; sellerHandle: string | null }[]
    }
    expect(body.items).toHaveLength(1)
    expect(body.items[0].title).toBe("Tecno Spark 20")
    expect(body.items[0].sellerName).toBe("Ama Shop")
    expect(body.items[0].sellerHandle).toBe("ama-shop")
  })
})

describe("POST /admin/products/:id/approve", () => {
  it("sets product status to published", async () => {
    const { app, adminToken, productId } = await adminProductApp()

    const res = await app.request(`/admin/products/${productId}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { product: { id: string; status: string } }
    expect(body.product.id).toBe(productId)
    expect(body.product.status).toBe("published")
  })
})

describe("POST /admin/products/:id/reject", () => {
  it("sets product status to rejected", async () => {
    const { app, adminToken, productId } = await adminProductApp()

    const res = await app.request(`/admin/products/${productId}/reject`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { product: { id: string; status: string } }
    expect(body.product.id).toBe(productId)
    expect(body.product.status).toBe("rejected")
  })
})
