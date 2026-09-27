import { primaryDb } from "./db"
import { parseEnv } from "./env"
import { PostgresCheckoutRepository } from "./postgres-checkout-repository"
import { reconcileStaleIntent } from "./lib/intent-reconcile"

/**
 * Abandoned momo/card checkouts hold reserved stock with no buyer attached.
 * Flips stale non-terminal intents to `expired` and releases their
 * reservations. Idempotent: CAS in updatePaymentIntentStatus makes double-fires
 * harmless.
 */
export const PAYMENT_INTENT_STALE_AFTER_MS = 60 * 60 * 1000

export async function runPaymentIntentExpiry(event: unknown, env: unknown, ctx: unknown) {
  const parsed = parseEnv(env as Record<string, unknown>)
  const checkout = new PostgresCheckoutRepository(primaryDb(parsed))
  const cutoff = new Date(Date.now() - PAYMENT_INTENT_STALE_AFTER_MS)
  const stale = await checkout.listStalePendingIntents(cutoff)
  let expired = 0
  for (const intent of stale) {
    // Same rule as the queue consumer: ask Paystack before expiring.
    const result = await reconcileStaleIntent(checkout, intent, { paystackSecretKey: parsed.PAYSTACK_SECRET_KEY }).catch(() => "skipped" as const)
    if (result === "expired") expired += 1
  }
  console.log(JSON.stringify({ job: "payment-intent-expiry", expired, scanned: stale.length }))
  void event
  void ctx
  return expired
}
