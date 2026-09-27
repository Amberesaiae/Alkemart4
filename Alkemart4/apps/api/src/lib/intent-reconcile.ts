import { PaystackError, verifyPaystackTransaction } from "@alkemart/paystack"
import type { CheckoutRepository, PaymentIntentRow } from "../checkout-repository"
import { confirmCheckoutFromPaystack, type VerifyPaystackTransaction } from "./checkout-confirm"
import type { JobProducer } from "../jobs"
import type { OrderEmailLinks } from "./order-emails"

/**
 * After this long we stop waiting on an in-flight Paystack charge and expire
 * it. Paystack retries webhooks for 72h, but a charge that's still
 * "ongoing"/"pending" after a day has been abandoned in practice.
 */
export const INTENT_HARD_EXPIRY_MS = 24 * 60 * 60 * 1000
const IN_FLIGHT = new Set(["ongoing", "pending", "processing", "queued", "send_otp", "send_birthday", "send_pin", "send_phone", "pay_offline"])

export type ReconcileResult = "confirmed" | "waiting" | "expired" | "skipped"

/**
 * Decide what to do with a stale momo/card intent — by asking Paystack,
 * never by the clock alone. Paystack only sends webhooks for successful
 * charges, and a late success webhook arriving after we expired the intent
 * would leave a charged buyer with no order. So:
 *   success          → create the order now (idempotent confirm)
 *   still in flight  → wait (until INTENT_HARD_EXPIRY_MS)
 *   anything else    → expire and release the stock
 */
export async function reconcileStaleIntent(
  checkout: CheckoutRepository,
  intent: PaymentIntentRow & { createdAt?: Date | null },
  opts: {
    paystackSecretKey?: string
    verify?: VerifyPaystackTransaction
    jobs?: JobProducer
    emailLinks?: OrderEmailLinks
    nowMs?: number
  },
): Promise<ReconcileResult> {
  const now = opts.nowMs ?? Date.now()
  const age = intent.createdAt ? now - intent.createdAt.getTime() : Number.POSITIVE_INFINITY
  const expire = async (why: string) => {
    try {
      await checkout.updatePaymentIntentStatus(intent.id, "expired")
      await checkout.releaseReservations(intent.id)
    } catch {
      return "skipped" as const // lost the race to the webhook — converge
    }
    console.log(JSON.stringify({ job: "intent-reconcile", intentId: intent.id, result: "expired", why }))
    return "expired" as const
  }

  // Never reached Paystack, or no key to ask with (local dev): nothing to verify.
  if (!intent.paystackReference) return expire("no paystack reference")
  if (!opts.paystackSecretKey) return expire("no paystack key to verify with")

  let status: string
  try {
    const verified = await (opts.verify ?? verifyPaystackTransaction)({ secretKey: opts.paystackSecretKey }, intent.paystackReference)
    status = verified.status.toLowerCase()
  } catch (err) {
    // Paystack answered "no such transaction" etc. → the buyer never paid.
    if (err instanceof PaystackError && err.definite) return expire(`paystack: ${err.message}`)
    // Unreachable: don't guess. Wait, unless we've waited a whole day.
    if (age < INTENT_HARD_EXPIRY_MS) return "waiting"
    console.error(JSON.stringify({ job: "intent-reconcile", intentId: intent.id, alert: "expired-unverified" }))
    return expire("paystack unreachable for 24h")
  }

  if (status === "success") {
    await confirmCheckoutFromPaystack(checkout, {
      paymentIntentId: intent.id,
      paystackSecretKey: opts.paystackSecretKey,
      verify: opts.verify,
      jobs: opts.jobs,
      emailLinks: opts.emailLinks,
    })
    console.log(JSON.stringify({ job: "intent-reconcile", intentId: intent.id, result: "confirmed" }))
    return "confirmed"
  }
  if (IN_FLIGHT.has(status) && age < INTENT_HARD_EXPIRY_MS) return "waiting"
  return expire(`paystack status ${status}`)
}
