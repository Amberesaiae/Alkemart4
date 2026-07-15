import { createHmac, timingSafeEqual } from "crypto"

export const PAYSTACK_API_BASE = "https://api.paystack.co"

/**
 * Money unit conversion for Paystack charges.
 *
 * Medusa store pricing for GHS uses **major units** (e.g. 25.50 GHS).
 * Paystack GHS API expects **pesewas (minor units)**: 1 GHS = 100 pesewas.
 *
 * Convert with: pesewas = Math.round(major * 100)
 *
 * Non-GHS currencies are rounded to integer as-is (caller must ensure units).
 */
export function toPaystackAmountPesewas(
  amount: number | string,
  currencyCode: string
): number {
  const n = typeof amount === "string" ? Number(amount) : Number(amount)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid amount for Paystack: ${amount}`)
  }

  const currency = (currencyCode || "ghs").toLowerCase()
  const pesewas =
    currency === "ghs" ? Math.round(n * 100) : Math.round(n)

  if (!Number.isInteger(pesewas) || pesewas < 0) {
    throw new Error(
      `Paystack amount must be a non-negative integer (got ${pesewas} for currency ${currency})`
    )
  }

  return pesewas
}

/**
 * Inverse: pesewas → major units for GHS (Medusa store amounts).
 */
export function fromPaystackAmountMajor(
  amountPesewas: number,
  currencyCode: string
): number {
  const currency = (currencyCode || "ghs").toLowerCase()
  if (currency === "ghs") {
    return amountPesewas / 100
  }
  return amountPesewas
}

/**
 * Verify Paystack webhook signature (HMAC-SHA512 of raw body).
 * Uses timing-safe comparison. Ported from Express paystack.ts.
 */
export function verifyPaystackWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined | null,
  secretKey: string
): boolean {
  if (!secretKey || !signatureHeader) {
    return false
  }

  const body =
    typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")
  const computed = createHmac("sha512", secretKey).update(body).digest("hex")

  try {
    const a = Buffer.from(computed, "hex")
    const b = Buffer.from(signatureHeader, "hex")
    if (a.length !== b.length) {
      return false
    }
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export type PaystackRequestOptions = {
  secretKey: string
  path: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: Record<string, unknown>
}

/**
 * Low-level Paystack HTTP helper. Throws on non-success API status.
 */
export async function paystackRequest<T = Record<string, unknown>>(
  options: PaystackRequestOptions
): Promise<T> {
  const method = options.method ?? "POST"
  const url = `${PAYSTACK_API_BASE}${options.path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.secretKey}`,
    "Content-Type": "application/json",
  }

  const init: RequestInit = { method, headers }
  if (options.body && method !== "GET") {
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)
  const json = (await res.json().catch(() => null)) as {
    status?: boolean
    message?: string
    data?: T
  } | null

  if (!res.ok || !json?.status) {
    const message = json?.message || `Paystack API error (${res.status})`
    throw new Error(message)
  }

  return json.data as T
}

export type PaystackVerifyResult = {
  status: string
  amount: number
  currency: string
  reference: string
  metadata?: Record<string, unknown>
  gateway_response?: string
}

export async function verifyPaystackTransaction(
  secretKey: string,
  reference: string
): Promise<PaystackVerifyResult | null> {
  try {
    return await paystackRequest<PaystackVerifyResult>({
      secretKey,
      path: `/transaction/verify/${encodeURIComponent(reference)}`,
      method: "GET",
    })
  } catch {
    return null
  }
}
