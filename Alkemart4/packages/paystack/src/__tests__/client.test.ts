import { afterEach, describe, expect, it, vi } from "vitest"
import {
  assertPaystackAmountMatches,
  chargePaystackMobileMoney,
  createPaystackTransferRecipient,
  mapMomoProviderToPaystackSlug,
  verifyPaystackWebhookSignature,
} from "../client"

const cfg = { secretKey: "sk_test", baseUrl: "https://api.paystack.co" }

describe("mapMomoProviderToPaystackSlug", () => {
  it("maps UI providers to Paystack slugs", () => {
    expect(mapMomoProviderToPaystackSlug("mtn")).toBe("mtn")
    expect(mapMomoProviderToPaystackSlug("vodafone")).toBe("vod")
    expect(mapMomoProviderToPaystackSlug("airteltigo")).toBe("atl")
  })
})

describe("assertPaystackAmountMatches", () => {
  it("accepts equal integer pesewas", () => {
    expect(() => assertPaystackAmountMatches(2550n, 2550)).not.toThrow()
  })

  it("rejects mismatch", () => {
    expect(() => assertPaystackAmountMatches(2550n, 2500)).toThrow(/amount mismatch/i)
  })

  it("rejects non-integers", () => {
    expect(() => assertPaystackAmountMatches(2550n, 25.5)).toThrow(/amount mismatch/i)
  })
})

describe("verifyPaystackWebhookSignature", () => {
  const secret = "sk_test_example_secret_key"
  const body = JSON.stringify({
    event: "charge.success",
    data: { reference: "ref_abc", amount: 2550, currency: "GHS" },
  })
  // HMAC-SHA512(secret, body) hex fixture — Paystack x-paystack-signature
  const signature =
    "0770dff0fe85af4a03f02f000040d328b6b9947296d5b8fdbc11f582ef39ca4dc65e0c17b623dc199c1bb5348247cab1a9482781b2fe333638d181087bafda13"

  it("accepts a valid HMAC-SHA512 signature", () => {
    expect(verifyPaystackWebhookSignature(body, signature, secret)).toBe(true)
  })

  it("rejects wrong signature", () => {
    expect(
      verifyPaystackWebhookSignature(body, signature.slice(0, -2) + "ff", secret),
    ).toBe(false)
  })

  it("rejects missing signature or secret", () => {
    expect(verifyPaystackWebhookSignature(body, "", secret)).toBe(false)
    expect(verifyPaystackWebhookSignature(body, signature, "")).toBe(false)
  })

  it("rejects tampered body", () => {
    expect(verifyPaystackWebhookSignature(body + " ", signature, secret)).toBe(false)
  })
})

describe("createPaystackTransferRecipient", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("POSTs mobile_money recipient and returns recipientCode", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        data: { recipient_code: "RCP_test_1" },
      }),
    }) as unknown as typeof fetch

    const result = await createPaystackTransferRecipient(cfg, {
      name: "Ama's Shop",
      accountNumber: "0244123456",
      bankCode: "MTN",
    })

    expect(result).toEqual({ recipientCode: "RCP_test_1" })

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://api.paystack.co/transferrecipient")
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test")
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({
      type: "mobile_money",
      name: "Ama's Shop",
      account_number: "0244123456",
      bank_code: "MTN",
      currency: "GHS",
    })
  })
})

describe("chargePaystackMobileMoney", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("charges with Paystack MoMo slugs and integer pesewas", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        data: {
          status: "success",
          reference: "ref_ok_1",
          gateway_response: "Approved",
        },
      }),
    }) as unknown as typeof fetch

    const result = await chargePaystackMobileMoney(cfg, {
      email: "a@b.com",
      amountPesewas: 1000n,
      phone: "0244123456",
      provider: "vodafone",
      reference: "ref_ok_1",
    })

    expect(result.status).toBe("success")
    expect(result.reference).toBe("ref_ok_1")

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://api.paystack.co/charge")
    const body = JSON.parse(String(init.body))
    expect(body.amount).toBe(1000)
    expect(body.mobile_money.provider).toBe("vod")
    expect(body.mobile_money.phone).toBe("0244123456")
    expect(body.reference).toBe("ref_ok_1")
    expect(body.currency).toBe("GHS")
  })
})
