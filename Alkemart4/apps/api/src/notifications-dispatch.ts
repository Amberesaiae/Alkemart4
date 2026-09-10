import type { CheckoutRepository } from "./checkout-repository"
import { primaryDb } from "./db"
import { parseEnv } from "./env"
import { PostgresCheckoutRepository } from "./postgres-checkout-repository"
import { smsProviderFromEnv, type SmsProvider } from "./sms"

export const NOTIFICATION_MAX_ATTEMPTS = 5

/**
 * Buyer SMS outbox sender. Claims due rows, sends each exactly once per
 * claim, marks sent/failed. Failures are recorded, never thrown — the next
 * run retries until max attempts. Idempotent: re-runs only pick up
 * pending/failed rows, and the unique outbox key stops double-enqueues.
 */
export async function dispatchPendingNotifications(
  checkout: CheckoutRepository,
  sms: SmsProvider,
  opts: { limit?: number; maxAttempts?: number } = {},
) {
  const maxAttempts = opts.maxAttempts ?? NOTIFICATION_MAX_ATTEMPTS
  const claimed = await checkout.claimPendingNotifications(opts.limit ?? 50, maxAttempts)
  let sent = 0
  let failed = 0
  for (const n of claimed) {
    try {
      await sms.send({ to: n.recipient, body: n.body })
      await checkout.markNotificationSent(n.id)
      sent += 1
    } catch (err) {
      await checkout.markNotificationFailed(n.id, err instanceof Error ? err.message : "sms failed")
      failed += 1
    }
  }
  console.log(JSON.stringify({ job: "notification-dispatch", claimed: claimed.length, sent, failed }))
  return { claimed: claimed.length, sent, failed }
}

/** Cron / admin-trigger entrypoint — builds live dependencies from env. */
export async function runNotificationDispatch(event: unknown, env: unknown, ctx: unknown) {
  const parsed = parseEnv(env as Record<string, unknown>)
  const checkout = new PostgresCheckoutRepository(primaryDb(parsed))
  const sms = smsProviderFromEnv({
    AT_USERNAME: parsed.AT_USERNAME,
    AT_API_KEY: parsed.AT_API_KEY,
    AT_SENDER_ID: parsed.AT_SENDER_ID,
  })
  const result = await dispatchPendingNotifications(checkout, sms)
  void event
  void ctx
  return result
}
