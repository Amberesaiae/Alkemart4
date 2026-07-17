import {
  assertPaystackAmountMatches,
  chargeMobileMoney,
  fromPaystackAmountMajor,
  mapMomoProviderToPaystackSlug,
  PaymentDeclinedError,
  refundCharge,
  toPaystackAmountPesewas,
  verifyPaystackWebhookSignature,
} from "../paystack-client"
import { createHmac } from "crypto"

describe("toPaystackAmountPesewas", () => {
  it("converts GHS major units to integer pesewas", () => {
    expect(toPaystackAmountPesewas(25.5, "ghs")).toBe(2550)
    expect(toPaystackAmountPesewas(25.5, "GHS")).toBe(2550)
    expect(toPaystackAmountPesewas("10.99", "ghs")).toBe(1099)
    expect(toPaystackAmountPesewas(0, "ghs")).toBe(0)
  })

  it("rounds fractional pesewas", () => {
    // 10.999 → 1099.9 → 1100
    expect(toPaystackAmountPesewas(10.999, "ghs")).toBe(1100)
  })

  it("rejects invalid amounts", () => {
    expect(() => toPaystackAmountPesewas(NaN, "ghs")).toThrow(/Invalid amount/)
    expect(() => toPaystackAmountPesewas(-1, "ghs")).toThrow(/Invalid amount/)
  })

  it("passes through non-GHS as rounded integer", () => {
    expect(toPaystackAmountPesewas(1500, "ngn")).toBe(1500)
  })
})

describe("fromPaystackAmountMajor", () => {
  it("converts GHS pesewas back to major units", () => {
    expect(fromPaystackAmountMajor(2550, "ghs")).toBe(25.5)
    expect(fromPaystackAmountMajor(100, "GHS")).toBe(1)
  })
})

describe("mapMomoProviderToPaystackSlug", () => {
  it("maps UI providers to Paystack slugs", () => {
    expect(mapMomoProviderToPaystackSlug("mtn")).toBe("mtn")
    expect(mapMomoProviderToPaystackSlug("vodafone")).toBe("vod")
    expect(mapMomoProviderToPaystackSlug("airteltigo")).toBe("atl")
  })
})

describe("assertPaystackAmountMatches", () => {
  it("accepts equal integer pesewas", () => {
    expect(() => assertPaystackAmountMatches(2550, 2550)).not.toThrow()
  })

  it("rejects mismatch", () => {
    expect(() => assertPaystackAmountMatches(2550, 2500)).toThrow(
      /amount mismatch/i
    )
  })

  it("rejects non-integers", () => {
    expect(() => assertPaystackAmountMatches(25.5, 25.5)).toThrow(
      /amount mismatch/i
    )
  })
})

describe("verifyPaystackWebhookSignature", () => {
  const secret = "sk_test_example_secret_key"
  const body = JSON.stringify({
    event: "charge.success",
    data: { reference: "ref_abc", amount: 2550, currency: "GHS" },
  })

  it("accepts a valid HMAC-SHA512 signature", () => {
    const signature = createHmac("sha512", secret).update(body).digest("hex")
    expect(verifyPaystackWebhookSignature(body, signature, secret)).toBe(true)
  })

  it("accepts Buffer body", () => {
    const signature = createHmac("sha512", secret).update(body).digest("hex")
    expect(
      verifyPaystackWebhookSignature(Buffer.from(body, "utf8"), signature, secret)
    ).toBe(true)
  })

  it("rejects wrong signature", () => {
    const signature = createHmac("sha512", secret).update(body).digest("hex")
    expect(
      verifyPaystackWebhookSignature(body, signature.slice(0, -2) + "ff", secret)
    ).toBe(false)
  })

  it("rejects missing signature or secret", () => {
    expect(verifyPaystackWebhookSignature(body, undefined, secret)).toBe(false)
    expect(verifyPaystackWebhookSignature(body, "abc", "")).toBe(false)
  })

  it("rejects tampered body", () => {
    const signature = createHmac("sha512", secret).update(body).digest("hex")
    expect(
      verifyPaystackWebhookSignature(body + " ", signature, secret)
    ).toBe(false)
  })
})

describe("chargeMobileMoney", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns success for sync charge", async () => {
    global.fetch = jest.fn().mockResolvedValue({
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

    const result = await chargeMobileMoney({
      secretKey: "sk_test",
      amountPesewas: 1000,
      email: "a@b.com",
      phone: "0244123456",
      provider: "mtn",
    })

    expect(result.status).toBe("success")
    expect(result.reference).toBe("ref_ok_1")

    const call = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.mobile_money.provider).toBe("mtn")
    expect(body.amount).toBe(1000)
  })

  it("returns pending for send_otp / pay_offline", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        data: {
          status: "send_otp",
          reference: "ref_pending_1",
        },
      }),
    }) as unknown as typeof fetch

    const result = await chargeMobileMoney({
      secretKey: "sk_test",
      amountPesewas: 1000,
      email: "a@b.com",
      phone: "0244123456",
      provider: "vodafone",
    })

    expect(result.status).toBe("pending")
    expect(result.providerStatus).toBe("send_otp")

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.mobile_money.provider).toBe("vod")
  })

  it("throws PaymentDeclinedError on hard decline", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: true,
        data: {
          status: "failed",
          reference: "ref_fail",
          gateway_response: "Insufficient funds",
        },
      }),
    }) as unknown as typeof fetch

    await expect(
      chargeMobileMoney({
        secretKey: "sk_test",
        amountPesewas: 1000,
        email: "a@b.com",
        phone: "0244123456",
        provider: "airteltigo",
      })
    ).rejects.toBeInstanceOf(PaymentDeclinedError)

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(body.mobile_money.provider).toBe("atl")
  })
})

describe("refundCharge", () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns ok on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: true, data: { id: 99 } }),
    }) as unknown as typeof fetch

    const result = await refundCharge({
      secretKey: "sk_test",
      reference: "ref_1",
      amountPesewas: 1000,
    })
    expect(result).toEqual({ ok: true, id: 99 })
  })

  it("returns ok:false without throwing on API error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ status: false, message: "already refunded" }),
    }) as unknown as typeof fetch

    const result = await refundCharge({
      secretKey: "sk_test",
      reference: "ref_1",
      amountPesewas: 1000,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/already refunded|Paystack/i)
    }
  })
})
