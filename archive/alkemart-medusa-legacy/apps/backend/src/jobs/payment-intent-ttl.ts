import type { MedusaContainer } from "@medusajs/framework/types"
import { abandonExpiredIntents } from "../lib/ghana-checkout"

/**
 * Expire initiated/pending payment intents past expires_at.
 * Does not complete carts — buyer may retry checkout.
 */
export default async function paymentIntentTtlJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as {
    info?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }

  try {
    const result = await abandonExpiredIntents(container)
    if (result.expired > 0) {
      logger?.info?.(
        `payment-intent-ttl: expired ${result.expired} intent(s)`,
        { ids: result.ids }
      )
    }
  } catch (err) {
    logger?.error?.(
      "payment-intent-ttl: failed",
      err instanceof Error ? err.message : err
    )
  }
}

export const config = {
  name: "payment-intent-ttl",
  // Every minute — short enough for PAYMENT_PENDING_TTL_MINUTES (10–120)
  schedule: "* * * * *",
}
