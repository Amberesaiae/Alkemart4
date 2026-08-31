import { hashPassword } from "@alkemart/domain"
import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

async function adminApp() {
  const authRepo = new InMemoryAuthRepository()
  await authRepo.createUser({
    id: "admin-1",
    email: "admin@alkemart.test",
    passwordHash: await hashPassword("AdminPass1"),
    role: "admin",
  })
  const app = createApp({ authRepo, jwtSecret: JWT_SECRET })
  const login = await app.request("/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@alkemart.test", password: "AdminPass1" }),
  })
  expect(login.status).toBe(200)
  const { token } = (await login.json()) as { token: string }

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
  const vendorBody = (await vendor.json()) as { user: { sellerId: string } }
  return { app, authRepo, token, sellerId: vendorBody.user.sellerId }
}

function authPost(token: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers["Content-Type"] = "application/json"
  return {
    method: "POST" as const,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }
}

describe("POST /admin/sellers/:id/approve", () => {
  it("sets seller status to open", async () => {
    const { app, authRepo, token, sellerId } = await adminApp()
    const before = await authRepo.findSellerById(sellerId)
    expect(before?.status).toBe("pending_approval")

    const res = await app.request(`/admin/sellers/${sellerId}/approve`, authPost(token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { seller: { id: string; status: string } }
    expect(body.seller.id).toBe(sellerId)
    expect(body.seller.status).toBe("open")

    const after = await authRepo.findSellerById(sellerId)
    expect(after?.status).toBe("open")
  })
})
