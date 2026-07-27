import { Modules } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  CheckoutHttpError,
  confirmMomoByPaystackReference,
} from "../../../lib/ghana-checkout"
import { verifyPaystackWebhookSignature } from "../../../lib/paystack-client"
import { logger } from "../../../lib/logger"
import { getRedisClient } from "../../../lib/redis-client"

const PAYSTACK_IPS: ReadonlySet<string> = new Set([
  "52.31.139.75",
  "52.49.173.169",
  "52.214.14.220",
])

const WEBHOOK_IPS_ENV = process.env.PAYSTACK_ALLOWED_IPS?.trim()

const IP_WHITELIST_DISABLED = process.env.PAYSTACK_SKIP_IP_CHECK === "true" || process.env.NODE_ENV === "development"

function ipIsAllowed(ip: string): boolean {
  if (IP_WHITELIST_DISABLED) return true
  if (WEBHOOK_IPS_ENV) {
    return WEBHOOK_IPS_ENV.split(",").some((cidr) => ip.startsWith(cidr.trim().replace("/32", "")))
  }
  return PAYSTACK_IPS.has(ip)
}

const WEBHOOK_DEDUP_TTL = 5 * 60

const inMemoryDedup = new Set<string>()

async function isDuplicate(eventId: string): Promise<boolean> {
  const r = getRedisClient()
  if (r) {
    try {
      const exists = await r.exists(`paystack:dedup:${eventId}`)
      if (exists) return true
      await r.setex(`paystack:dedup:${eventId}`, WEBHOOK_DEDUP_TTL, "1")
      return false
    } catch {
      /* fall through to in-memory */
    }
  }
  if (inMemoryDedup.has(eventId)) return true
  inMemoryDedup.add(eventId)
  setTimeout(() => inMemoryDedup.delete(eventId), WEBHOOK_DEDUP_TTL * 1000)
  return false
}

type PaystackEvent = {
  event?: string
  data?: {
    id?: string
    reference?: string
    status?: string
    amount?: number
    currency?: string
    metadata?: Record<string, unknown>
    gateway_response?: string
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const clientIp =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] as string | undefined ||
    req.socket?.remoteAddress ||
    ""

  if (!ipIsAllowed(clientIp)) {
    logger.warn("[paystack-webhook] blocked request from untrusted IP", { clientIp })
    res.status(403).json({ error: "untrusted source" })
    return
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!secretKey) {
    res.status(503).json({ error: "PAYSTACK_SECRET_KEY not configured" })
    return
  }

  const signatureHeader =
    (req.headers["x-paystack-signature"] as string | undefined) ||
    (req.headers["X-Paystack-Signature"] as string | undefined)

  const rawBody: string =
    typeof (req as { rawBody?: unknown }).rawBody === "string"
      ? ((req as { rawBody: string }).rawBody as string)
      : Buffer.isBuffer((req as { rawBody?: unknown }).rawBody)
        ? (req as { rawBody: Buffer }).rawBody.toString("utf8")
        : (() => {
            logger.warn("[paystack] rawBody not available on request — JSON.stringify may cause HMAC mismatch")
            return JSON.stringify(req.body ?? {})
          })()

  const signatureOk = verifyPaystackWebhookSignature(rawBody, signatureHeader, secretKey)
  if (!signatureOk) {
    logger.warn("[paystack-webhook] HMAC signature mismatch", { clientIp })
    res.status(400).json({ error: "invalid signature" })
    return
  }

  let event: PaystackEvent
  try {
    event =
      typeof req.body === "object" && req.body
        ? (req.body as PaystackEvent)
        : (JSON.parse(rawBody) as PaystackEvent)
  } catch {
    res.status(400).json({ error: "Invalid JSON body" })
    return
  }

  const eventId = event.data?.id
  if (eventId && typeof eventId === "string") {
    if (await isDuplicate(eventId)) {
      logger.info("[paystack-webhook] duplicate event — skipping", { eventId })
      return Response.json({ status: "duplicate" })
    }
  }

  const eventName = String(event.event || "")
  const reference = event.data?.reference

  logger.info("[paystack-webhook] received event", { eventName, reference, eventId })

  if (!reference) {
    res.status(200).json({ received: true, ignored: "no_reference" })
    return
  }

  if (eventName === "charge.failed") {
    const meta = event.data?.metadata ?? {}
    const cartId = String(meta.cart_id ?? meta.cartId ?? "").trim()
    if (cartId) {
      try {
        const cartModule = req.scope.resolve(Modules.CART) as {
          updateCarts: (data: { id: string; metadata?: Record<string, unknown> }[]) => Promise<unknown>
        }
        await cartModule.updateCarts([{
          id: cartId,
          metadata: { ghana_payment_status: "failed" },
        }])
      } catch {
        logger.warn("[paystack-webhook] failed to update payment status for cart", { cartId })
      }
    }
    res.status(200).json({ received: true, status: "failed", reference })
    return
  }

  if (eventName !== "charge.success") {
    res.status(200).json({ received: true, ignored: eventName || "unknown" })
    return
  }

  try {
    const result = await confirmMomoByPaystackReference(req.scope, reference)
    res.status(200).json({ received: true, ...result })
  } catch (err) {
    if (err instanceof CheckoutHttpError) {
      const retryable = err.status === 409
      res.status(retryable ? 200 : err.status).json({
        received: true,
        error: err.message,
        status: retryable ? "pending" : "error",
      })
      return
    }
    res.status(500).json({
      received: true,
      error: err instanceof Error ? err.message : "Webhook handler failed",
    })
  }
}
