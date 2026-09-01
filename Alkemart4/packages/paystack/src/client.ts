/// <reference path="./node-crypto.d.ts" />
import { createHmac } from "node:crypto"

export type PaystackConfig = { secretKey: string; baseUrl?: string }

const PAYSTACK_API_BASE = "https://api.paystack.co"

const PAYSTACK_MOMO_PROVIDER_SLUGS = {
  mtn: "mtn",
  vodafone: "vod",
  airteltigo: "atl",
} as const

export type PaystackMomoProvider = keyof typeof PAYSTACK_MOMO_PROVIDER_SLUGS
export type PaystackMomoSlug = (typeof PAYSTACK_MOMO_PROVIDER_SLUGS)[PaystackMomoProvider]

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!
  }
  return diff === 0
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!secret || !signature) {
    return false
  }
  const computed = createHmac("sha512", secret).update(rawBody).digest("hex")
  const a = hexToBytes(computed)
  const b = hexToBytes(signature)
  if (!a || !b) {
    return false
  }
  return timingSafeEqual(a, b)
}

export function mapMomoProviderToPaystackSlug(
  provider: "mtn" | "vodafone" | "airteltigo",
): "mtn" | "vod" | "atl" {
  const slug = PAYSTACK_MOMO_PROVIDER_SLUGS[provider]
  if (!slug) {
    throw new Error(`Unsupported MoMo provider: ${provider}`)
  }
  return slug
}

export function assertPaystackAmountMatches(
  expectedPesewas: bigint,
  paystackAmount: number,
): void {
  if (!Number.isInteger(paystackAmount) || expectedPesewas !== BigInt(paystackAmount)) {
    throw new Error(
      `Paystack amount mismatch: provider=${paystackAmount} intent=${expectedPesewas} (pesewas)`,
    )
  }
}

function paystackBaseUrl(cfg: PaystackConfig): string {
  return (cfg.baseUrl ?? PAYSTACK_API_BASE).replace(/\/+$/, "")
}

export async function paystackRequest<T = Record<string, unknown>>(
  cfg: PaystackConfig,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE"
    body?: Record<string, unknown>
  } = {},
): Promise<T> {
  if (!cfg.secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured")
  }

  const method = options.method ?? "POST"
  const url = `${paystackBaseUrl(cfg)}${path.startsWith("/") ? path : `/${path}`}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.secretKey}`,
    "Content-Type": "application/json",
  }

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(10_000),
  }
  if (options.body && method !== "GET") {
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)
  const json = (await res.json().catch(() => null)) as {
    status?: boolean
    message?: string
    data?: T & { message?: unknown }
  } | null

  if (!res.ok || !json?.status) {
    const nested =
      json?.data &&
      typeof json.data === "object" &&
      typeof (json.data as { message?: unknown }).message === "string"
        ? String((json.data as { message: string }).message)
        : null
    throw new Error(nested || json?.message || `Paystack API error (${res.status})`)
  }

  return json.data as T
}

export async function createPaystackTransferRecipient(
  cfg: PaystackConfig,
  input: {
    name: string
    accountNumber: string
    bankCode: string
    currency?: "GHS"
  },
): Promise<{ recipientCode: string }> {
  const data = await paystackRequest<{ recipient_code?: string }>(cfg, "/transferrecipient", {
    method: "POST",
    body: {
      type: "mobile_money",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency ?? "GHS",
    },
  })
  if (!data?.recipient_code) {
    throw new Error("Paystack did not return a recipient_code")
  }
  return { recipientCode: data.recipient_code }
}

export async function chargePaystackMobileMoney(
  cfg: PaystackConfig,
  input: {
    email: string
    amountPesewas: bigint
    phone: string
    provider: "mtn" | "vodafone" | "airteltigo"
    reference: string
  },
): Promise<{ status: string; reference: string; data: unknown }> {
  if (input.amountPesewas < 0n || input.amountPesewas > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`amountPesewas must be a non-negative integer (got ${input.amountPesewas})`)
  }

  const data = await paystackRequest<{
    status?: string
    reference?: string
  }>(cfg, "/charge", {
    method: "POST",
    body: {
      amount: Number(input.amountPesewas),
      email: input.email,
      currency: "GHS",
      reference: input.reference,
      mobile_money: {
        phone: input.phone,
        provider: mapMomoProviderToPaystackSlug(input.provider),
      },
    },
  })

  if (!data?.reference) {
    throw new Error("Paystack did not return a reference for this charge.")
  }

  return {
    status: String(data.status ?? ""),
    reference: data.reference,
    data,
  }
}

export async function initializePaystackTransaction(
  cfg: PaystackConfig,
  input: {
    email: string
    amountPesewas: bigint
    reference: string
    callbackUrl: string
  },
): Promise<{ authorizationUrl: string; reference: string; accessCode: string }> {
  if (input.amountPesewas < 0n || input.amountPesewas > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`amountPesewas must be a non-negative integer (got ${input.amountPesewas})`)
  }

  const data = await paystackRequest<{
    authorization_url?: string
    reference?: string
    access_code?: string
  }>(cfg, "/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: Number(input.amountPesewas),
      currency: "GHS",
      reference: input.reference,
      callback_url: input.callbackUrl,
    },
  })

  if (!data?.authorization_url || !data.reference || !data.access_code) {
    throw new Error("Paystack initialize did not return authorization_url/reference/access_code")
  }

  return {
    authorizationUrl: data.authorization_url,
    reference: data.reference,
    accessCode: data.access_code,
  }
}

export async function verifyPaystackTransaction(
  cfg: PaystackConfig,
  reference: string,
): Promise<{ status: string; amount: number; reference: string; raw: unknown }> {
  const data = await paystackRequest<{
    status?: string
    amount?: number
    reference?: string
  }>(cfg, `/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  })

  if (!data?.reference || typeof data.amount !== "number") {
    throw new Error("Paystack verify did not return reference/amount")
  }

  return {
    status: String(data.status ?? ""),
    amount: data.amount,
    reference: data.reference,
    raw: data,
  }
}

export async function createPaystackTransfer(
  cfg: PaystackConfig,
  input: {
    amountPesewas: bigint
    recipientCode: string
    reference: string
    reason?: string
  },
): Promise<{ transferCode: string; reference: string; status: string }> {
  if (input.amountPesewas <= 0n || input.amountPesewas > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`amountPesewas must be a positive integer (got ${input.amountPesewas})`)
  }

  const data = await paystackRequest<{
    transfer_code?: string
    reference?: string
    status?: string
  }>(cfg, "/transfer", {
    method: "POST",
    body: {
      source: "balance",
      amount: Number(input.amountPesewas),
      recipient: input.recipientCode,
      reason: input.reason ?? "Alkemart seller payout",
      reference: input.reference,
      currency: "GHS",
    },
  })

  if (!data?.transfer_code || !data.reference) {
    throw new Error("Paystack transfer did not return transfer_code/reference")
  }

  return {
    transferCode: data.transfer_code,
    reference: data.reference,
    status: String(data.status ?? ""),
  }
}
