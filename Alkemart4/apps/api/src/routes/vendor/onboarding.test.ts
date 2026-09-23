import { describe, expect, it } from "vitest"
import { InMemoryAuthRepository } from "../../auth-repository"
import type { CreatePaystackTransferRecipient } from "../../context"
import { createApp } from "../../index"
import { resetRateLimits } from "../../middleware/security"
// Rate-limit counters are per-process: reset so files stay isolated.
resetRateLimits()

const JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long"

type RecipientCall = { cfg: unknown; input: unknown }

function mockCreateRecipient(
  calls: RecipientCall[] = [],
): CreatePaystackTransferRecipient {
  return (async (cfg: unknown, input: unknown) => {
    calls.push({ cfg, input })
    return { recipientCode: "RCP_test" }
  }) as unknown as CreatePaystackTransferRecipient
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
    const calls: RecipientCall[] = []
    const { app, authRepo, token, sellerId } = await vendorApp({
      paystackSecretKey: "sk_test",
      createPaystackTransferRecipient: mockCreateRecipient(calls),
    })
    const res = await app.request(
      "/vendor/onboarding/ghana-setup",
      authJson("POST", token, ghanaSetupBody),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ready: true, missing: [] })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      cfg: { secretKey: "sk_test" },
      input: {
        name: "Ama Mensah",
        accountNumber: "0244123456",
        bankCode: "MTN",
        currency: "GHS",
      },
    })
    const seller = await authRepo.findSellerById(sellerId)
    expect(seller?.recipientCode).toBe("RCP_test")
    expect(seller?.packRegion).toBe("GH07")
    expect(seller?.momoProvider).toBe("mtn")
    expect(seller?.momoPhone).toBe("0244123456")
    expect(seller?.digitalAddress).toBe("GA-184-1234")
    expect(seller?.deliveryFeePesewas).toBe(2000n)
  })

  it("returns 503 when PAYSTACK_SECRET_KEY is missing and does not invent a recipient", async () => {
    const calls: RecipientCall[] = []
    const { app, authRepo, token, sellerId } = await vendorApp({
      createPaystackTransferRecipient: mockCreateRecipient(calls),
    })
    const res = await app.request(
      "/vendor/onboarding/ghana-setup",
      authJson("POST", token, ghanaSetupBody),
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/PAYSTACK_SECRET_KEY/)
    expect(calls).toEqual([])
    const seller = await authRepo.findSellerById(sellerId)
    expect(seller?.recipientCode).toBeNull()
  })
})
