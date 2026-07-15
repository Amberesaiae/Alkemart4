import {
  fromPaystackAmountMajor,
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
