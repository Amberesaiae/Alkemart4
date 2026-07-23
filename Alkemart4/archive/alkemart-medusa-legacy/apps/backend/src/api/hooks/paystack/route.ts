/**
 * Paystack webhook: charge.success → confirmPaidByProviderReference.
 *
 * Requires raw body for HMAC (see src/api/middlewares.ts preserveRawBody).
 * Always returns 200 { received: true } after handling (idempotent).
 * Returns 401 on bad signature.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  confirmPaidByProviderReference,
  CheckoutHttpError,
} from "../../../lib/ghana-checkout"
import { verifyPaystackWebhookSignature } from "../../../lib/paystack-client"

type PaystackWebhookBody = {
  event?: string
  data?: {
    reference?: string
    amount?: number
    currency?: string
    status?: string
    metadata?: Record<string, unknown>
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    res.status(500).json({ error: "PAYSTACK_SECRET_KEY is not configured" })
    return
  }

  const signatureHeader =
    (req.headers["x-paystack-signature"] as string | undefined) ||
    (req.headers["X-Paystack-Signature"] as string | undefined)

  // prefer rawBody for HMAC; fall back to re-stringified body (less ideal)
  const rawBody: string | Buffer =
    (req as MedusaRequest & { rawBody?: string | Buffer }).rawBody ??
    JSON.stringify(req.body ?? {})

  const valid = verifyPaystackWebhookSignature(
    rawBody,
    signatureHeader,
    secretKey
  )
  if (!valid) {
    res.status(401).json({ error: "Invalid Paystack signature" })
    return
  }

  const event = (req.body ?? {}) as PaystackWebhookBody

  try {
    if (event.event === "charge.success") {
      const reference = event.data?.reference
      if (reference) {
        await confirmPaidByProviderReference(req.scope, reference)
      }
    }
    // Other events: acknowledge without side effects
  } catch (err) {
    // Log but still 200 so Paystack does not hammer retries for business errors
    // (amount mismatch, cart complete failures already refunded in confirmPaid).
    // Signature was valid — we received the event.
    const message = err instanceof Error ? err.message : String(err)
    const logger = req.scope.resolve("logger") as {
      error?: (...args: unknown[]) => void
      warn?: (...args: unknown[]) => void
    }
    logger?.error?.("Paystack webhook handling error", {
      message,
      event: event.event,
      reference: event.data?.reference,
      isCheckoutHttpError: err instanceof CheckoutHttpError,
    })
  }

  res.status(200).json({ received: true })
}
