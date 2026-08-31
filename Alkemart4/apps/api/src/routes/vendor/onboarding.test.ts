import { describe, expect, it, vi } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import type { CreatePaystackTransferRecipient } from "../../context"
import { createApp } from "../../index"

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

function mockCreateRecipient(): CreatePaystackTransferRecipient {
  return vi.fn(async () => ({ recipientCode: "RCP_test" }))
}

const ghanaSetupBody = {
  displayName: "Ama's Shop",
  region: "GH07",
  digitalAddress: "GA-184-1234",
  deliveryFeePesewas: "2000",
  momo: {
    provider: "mtn" as const,
    phone: "0244123456",
    accountName: "Ama Mensah",
  },
}

async function vendorApp(
  options: {
    paystackSecretKey?: string
    createPaystackTransferRecipient?: CreatePaystackTransferRecipient
  } = {},
) {
  const authRepo = new InMemoryAuthRepository()
  const createPaystackTransferRecipient =
    options.createPaystackTransferRecipient ?? mockCreateRecipient()
  const app = createApp({
    authRepo,
    jwtSecret: JWT_SECRET,
    paystackSecretKey: options.paystackSecretKey,
    createPaystackTransferRecipient,
  })
  const res = await app.request("/vendor/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "ama@alkemart.test",
      password: "VendorPass1",
      sellerName: "Ama's Shop",
      sellerHandle: "ama-shop",
    }),
  })
  const body = (await res.json()) as { token: string; user: { sellerId: string } }
  return { app, authRepo, token: body.token, sellerId: body.user.sellerId, createPaystackTransferRecipient }
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

describe("GET /vendor/onboarding/status", () => {
  it("returns unreadiness for a newly registered vendor", async () => {
    const { app, token } = await vendorApp({ paystackSecretKey: "sk_test" })
    const res = await app.request("/vendor/onboarding/status", authJson("GET", token))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ready: false,
      missing: ["region", "recipient_code"],
    })
  })
})

describe("POST /vendor/onboarding/ghana-setup", () => {
  it("stores Paystack recipient_code from the mock and returns ready", async () => {
    const { app, authRepo, token, sellerId, createPaystackTransferRecipient } = await vendorApp({
      paystackSecretKey: "sk_test",
    })
    const res = await app.request(
      "/vendor/onboarding/ghana-setup",
      authJson("POST", token, ghanaSetupBody),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ready: true, missing: [] })
    expect(vi.mocked(createPaystackTransferRecipient)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createPaystackTransferRecipient)).toHaveBeenCalledWith(
      { secretKey: "sk_test" },
      {
        name: "Ama Mensah",
        accountNumber: "0244123456",
        bankCode: "MTN",
        currency: "GHS",
      },
    )
    const seller = await authRepo.findSellerById(sellerId)
    expect(seller?.recipientCode).toBe("RCP_test")
    expect(seller?.packRegion).toBe("GH07")
    expect(seller?.momoProvider).toBe("mtn")
    expect(seller?.momoPhone).toBe("0244123456")
    expect(seller?.digitalAddress).toBe("GA-184-1234")
    expect(seller?.deliveryFeePesewas).toBe(2000n)
  })

  it("returns 503 when PAYSTACK_SECRET_KEY is missing and does not invent a recipient", async () => {
    const createPaystackTransferRecipient = mockCreateRecipient()
    const { app, authRepo, token, sellerId } = await vendorApp({
      createPaystackTransferRecipient,
    })
    const res = await app.request(
      "/vendor/onboarding/ghana-setup",
      authJson("POST", token, ghanaSetupBody),
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/PAYSTACK_SECRET_KEY/)
    expect(createPaystackTransferRecipient).not.toHaveBeenCalled()
    const seller = await authRepo.findSellerById(sellerId)
    expect(seller?.recipientCode).toBeNull()
  })
})
