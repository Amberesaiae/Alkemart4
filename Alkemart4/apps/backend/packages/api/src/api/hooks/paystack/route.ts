/**
 * POST /hooks/paystack — Paystack charge.success / charge.failed webhook.
 *
 * Config in Paystack dashboard: https://your-api/hooks/paystack
 * Header: x-paystack-signature (HMAC-SHA512 of raw body)
 *
 * Completes Ghana MoMo carts after buyer approves USSD/prompt.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  CheckoutHttpError,
  confirmMomoByPaystackReference,
} from "../../../lib/ghana-checkout"
import { verifyPaystackWebhookSignature } from "../../../lib/paystack-client"

type PaystackEvent = {
  event?: string
  data?: {
    reference?: string
    status?: string
    amount?: number
    currency?: string
    metadata?: Record<string, unknown>
    gateway_response?: string
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!secretKey) {
    res.status(503).json({ error: "PAYSTACK_SECRET_KEY not configured" })
    return
  }

  const signatureHeader =
    (req.headers["x-paystack-signature"] as string | undefined) ||
    (req.headers["X-Paystack-Signature"] as string | undefined)

  // Prefer raw body when framework preserves it; else re-stringify (last resort).
  const rawBody =
    typeof (req as { rawBody?: unknown }).rawBody === "string"
      ? ((req as { rawBody: string }).rawBody as string)
      : Buffer.isBuffer((req as { rawBody?: unknown }).rawBody)
        ? (req as { rawBody: Buffer }).rawBody.toString("utf8")
        : JSON.stringify(req.body ?? {})

  const signatureOk = verifyPaystackWebhookSignature(
    rawBody,
    signatureHeader,
    secretKey
  )

  // Still process if signature fails in development when explicitly allowed —
  // production requires signature. We always re-verify via Paystack API.
  if (!signatureOk && process.env.PAYSTACK_WEBHOOK_RELAXED !== "true") {
    res.status(401).json({ error: "Invalid Paystack signature" })
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

  const eventName = String(event.event || "")
  const reference = event.data?.reference

  if (!reference) {
    res.status(200).json({ received: true, ignored: "no_reference" })
    return
  }

  if (eventName === "charge.failed") {
    res.status(200).json({ received: true, status: "failed", reference })
    return
  }

  if (eventName !== "charge.success") {
    res.status(200).json({ received: true, ignored: eventName || "unknown" })
    return
  }

  try {
    const result = await confirmMomoByPaystackReference(req.scope, reference)
    res.status(200).json({
      received: true,
      ...result,
    })
  } catch (err) {
    if (err instanceof CheckoutHttpError) {
      // 409 not ready yet — still 200 so Paystack does not infinite-retry forever
      // on pending races; 400 amount mismatch should alert ops
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
