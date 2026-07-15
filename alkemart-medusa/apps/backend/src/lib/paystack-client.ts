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

/** Buyer-facing MoMo provider names (store API / SPA). */
export type MomoProvider = "mtn" | "vodafone" | "airteltigo"

/**
 * Paystack Ghana mobile_money.provider slugs (distinct from UI names).
 * Ported from Express paystack.ts.
 */
export const PAYSTACK_MOMO_PROVIDER_SLUGS: Record<MomoProvider, string> = {
  mtn: "mtn",
  vodafone: "vod",
  airteltigo: "atl",
}

export function mapMomoProviderToPaystackSlug(provider: MomoProvider): string {
  const slug = PAYSTACK_MOMO_PROVIDER_SLUGS[provider]
  if (!slug) {
    throw new Error(`Unsupported MoMo provider: ${provider}`)
  }
  return slug
}

/**
 * Strict amount invariant: Paystack amount (pesewas) must equal intent amount.
 */
export function assertPaystackAmountMatches(
  paystackAmountPesewas: number,
  intentAmountPesewas: number
): void {
  const a = Number(paystackAmountPesewas)
  const b = Number(intentAmountPesewas)
  if (!Number.isInteger(a) || !Number.isInteger(b) || a !== b) {
    throw new Error(
      `Paystack amount mismatch: provider=${a} intent=${b} (pesewas)`
    )
  }
}

export class PaymentDeclinedError extends Error {
  readonly code = "PAYMENT_DECLINED"
  constructor(message: string) {
    super(message)
    this.name = "PaymentDeclinedError"
  }
}

export type ChargeMobileMoneyResult = {
  reference: string
  /** sync success vs async pending (send_otp / pay_offline / pending) */
  status: "success" | "pending"
  providerStatus: string
  gateway_response?: string
}

export type ChargeMobileMoneyParams = {
  secretKey: string
  amountPesewas: number
  email: string
  phone: string
  provider: MomoProvider
  currency?: string
  metadata?: Record<string, unknown>
  /** Optional client reference; Paystack uses as transaction reference when set. */
  reference?: string
}

/**
 * Charge Ghana mobile money via Paystack Charge API.
 * Throws PaymentDeclinedError on hard declines / network failures that cannot proceed.
 */
export async function chargeMobileMoney(
  params: ChargeMobileMoneyParams
): Promise<ChargeMobileMoneyResult> {
  if (!params.secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured")
  }
  if (!Number.isInteger(params.amountPesewas) || params.amountPesewas < 0) {
    throw new Error(
      `amountPesewas must be a non-negative integer (got ${params.amountPesewas})`
    )
  }

  const currency = (params.currency ?? "ghs").toUpperCase()
  const body: Record<string, unknown> = {
    amount: params.amountPesewas,
    email: params.email,
    currency,
    mobile_money: {
      phone: params.phone,
      provider: mapMomoProviderToPaystackSlug(params.provider),
    },
    metadata: params.metadata ?? {},
  }
  if (params.reference) {
    body.reference = params.reference
  }

  let data: {
    status?: string
    reference?: string
    gateway_response?: string
  }
  try {
    data = await paystackRequest({
      secretKey: params.secretKey,
      path: "/charge",
      method: "POST",
      body,
    })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not reach the mobile money payment provider"
    // Network / API reject → treat as decline for checkout UX
    throw new PaymentDeclinedError(message)
  }

  if (!data?.reference) {
    throw new PaymentDeclinedError(
      "Payment provider did not return a reference for this charge."
    )
  }

  const chargeStatus = String(data.status || "").toLowerCase()

  if (chargeStatus === "success") {
    return {
      reference: data.reference,
      status: "success",
      providerStatus: chargeStatus,
      gateway_response: data.gateway_response,
    }
  }

  if (
    chargeStatus === "pending" ||
    chargeStatus === "send_otp" ||
    chargeStatus === "pay_offline"
  ) {
    return {
      reference: data.reference,
      status: "pending",
      providerStatus: chargeStatus,
      gateway_response: data.gateway_response,
    }
  }

  throw new PaymentDeclinedError(
    data.gateway_response ||
      "Your mobile money payment was not approved. Please confirm the prompt on your phone and try again."
  )
}

export type RefundChargeParams = {
  secretKey: string
  reference: string
  amountPesewas: number
}

export type RefundChargeResult =
  | { ok: true; id?: number }
  | { ok: false; error: string }

/**
 * Refund a successful Paystack charge. Never throws — callers log failures
 * for ops reconciliation (e.g. charge succeeded but order creation failed).
 */
export async function refundCharge(
  params: RefundChargeParams
): Promise<RefundChargeResult> {
  if (!params.secretKey) {
    return { ok: false, error: "PAYSTACK_SECRET_KEY is not configured" }
  }
  if (!params.reference) {
    return { ok: false, error: "reference is required for refund" }
  }

  try {
    const data = await paystackRequest<{ id?: number }>({
      secretKey: params.secretKey,
      path: "/refund",
      method: "POST",
      body: {
        transaction: params.reference,
        amount: params.amountPesewas,
      },
    })
    return { ok: true, id: data?.id }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Refund request failed",
    }
  }
}
