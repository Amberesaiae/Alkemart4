import { primaryDb } from "./db"
import { parseEnv } from "./env"
import { PostgresCheckoutRepository } from "./postgres-checkout-repository"

/**
 * Abandoned momo/card checkouts hold reserved stock with no buyer attached.
 * Flips stale non-terminal intents to `expired` and releases their
 * reservations. Idempotent: CAS in updatePaymentIntentStatus makes double-fires
 * harmless.
 */
const PAYMENT_INTENT_STALE_AFTER_MS = 60 * 60 * 1000

export async function runPaymentIntentExpiry(event: unknown, env: unknown, ctx: unknown) {
  const parsed = parseEnv(env as Record<string, unknown>)
  const checkout = new PostgresCheckoutRepository(primaryDb(parsed))
  const cutoff = new Date(Date.now() - PAYMENT_INTENT_STALE_AFTER_MS)
  const stale = await checkout.listStalePendingIntents(cutoff)
  let expired = 0
  for (const intent of stale) {
    try {
      await checkout.updatePaymentIntentStatus(intent.id, "expired")
      await checkout.releaseReservations(intent.id)
      expired += 1
    } catch {
      /* already transitioned elsewhere — leave it be */
    }
  }
  console.log(JSON.stringify({ job: "payment-intent-expiry", expired, scanned: stale.length }))
  void event
  void ctx
  return expired
}
