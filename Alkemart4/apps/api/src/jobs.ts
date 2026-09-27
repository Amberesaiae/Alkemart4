import { z } from "zod"
import type { CheckoutRepository } from "./checkout-repository"
import { dispatchPendingNotifications } from "./notifications-dispatch"
import { PAYMENT_INTENT_STALE_AFTER_MS } from "./payment-intent-expiry"
import type { SmsProvider } from "./sms"
import type { EmailProvider } from "./email"
import type { VerifyPaystackTransaction } from "./lib/checkout-confirm"
import { reconcileStaleIntent } from "./lib/intent-reconcile"
import type { OrderEmailLinks } from "./lib/order-emails"

/**
 * Async job contracts (agnostic plan Phase 2). Domain owns the message shapes
 * and idempotency keys; Cloudflare Queues is one adapter (producer binding +
 * `queue()` consumer in index.ts), the inline runner is another (tests, and
 * graceful fallback when queue bindings are absent).
 *
 * Delivery is at-least-once (verified platform semantics), so every consumer
 * path must converge on redelivery: expiry via compare-and-swap status moves,
 * notifications via atomic outbox claims. Poison (unparseable) messages throw
 * so they ride retries into the DLQ instead of spinning forever.
 */

/** Queue binding names in env/wrangler.toml. Logic references these, never literals. */
export const JOB_QUEUE_BINDINGS = {
  expiry: "JOBS_INTENT_EXPIRY",
  notifications: "JOBS_NOTIFICATIONS",
} as const

const IntentExpiryMessageSchema = z.object({
  kind: z.literal("intent-expiry"),
  intentId: z.string().min(1),
  /** `intent-expiry:{intentId}` — redeliveries converge on the same intent. */
  idempotencyKey: z.string().min(1),
})

const NotificationSweepMessageSchema = z.object({
  kind: z.literal("notification-sweep"),
  /** `notification-sweep:{unixMinute}` — sweeps are naturally idempotent via claims. */
  idempotencyKey: z.string().min(1),
})

/**
 * Automatic payout once a seller-only delivery's report window ends. Early
 * deliveries re-queue themselves (queue delays cap at 12h); paying twice is
 * impossible because a payout reserves its orders first.
 */
const AutoPayoutMessageSchema = z.object({
  kind: z.literal("auto-payout"),
  sellerId: z.string().min(1),
  notBeforeMs: z.number(),
  /** `auto-payout:{orderId}` */
  idempotencyKey: z.string().min(1),
})

export const JobMessageSchema = z.discriminatedUnion("kind", [
  IntentExpiryMessageSchema,
  NotificationSweepMessageSchema,
  AutoPayoutMessageSchema,
])

export type JobMessage = z.infer<typeof JobMessageSchema>

export function intentExpiryMessage(intentId: string): JobMessage {
  return { kind: "intent-expiry", intentId, idempotencyKey: `intent-expiry:${intentId}` }
}

export function notificationSweepMessage(nowMs = Date.now()): JobMessage {
  return {
    kind: "notification-sweep",
    idempotencyKey: `notification-sweep:${Math.floor(nowMs / 60_000)}`,
  }
}

export function autoPayoutMessage(orderId: string, sellerId: string, releaseAt: Date): JobMessage {
  return { kind: "auto-payout", sellerId, notBeforeMs: releaseAt.getTime(), idempotencyKey: `auto-payout:${orderId}` }
}

/** Cloudflare Queues caps a message delay at 12 hours. */
export const MAX_QUEUE_DELAY_SECONDS = 12 * 3600

/** Delay for the per-intent expiry message, derived from the stale threshold. */
export function expiryDelaySeconds(): number {
  return Math.ceil(PAYMENT_INTENT_STALE_AFTER_MS / 1000)
}

/**
 * Publish without ever breaking the request path: checkout correctness must
 * not depend on queue availability. Gaps are covered by the next event's
 * sweep and the admin expiry fallback — failures are logged loudly, never
 * thrown.
 */
export async function publishJob(
  producer: JobProducer,
  queue: keyof typeof JOB_QUEUE_BINDINGS,
  msg: JobMessage,
  opts?: { delaySeconds?: number },
): Promise<void> {
  try {
    await producer.publish(queue, msg, opts)
  } catch (error) {
    console.error(
      JSON.stringify({
        job: "publish-failed",
        queue,
        idempotencyKey: msg.idempotencyKey,
        error: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}

/** Structural subset of the Queue binding (send only). */
export type QueueLike = {
  send(message: unknown, opts?: { delaySeconds?: number }): Promise<void>
}

export type JobProducer = {
  publish(queue: keyof typeof JOB_QUEUE_BINDINGS, msg: JobMessage, opts?: { delaySeconds?: number }): Promise<void>
}

/** Production adapter: real queue bindings resolved from env. */
export function cfJobProducer(queues: { expiry: QueueLike; notifications: QueueLike }): JobProducer {
  return {
    publish: (queue, msg, opts) =>
      (queue === "expiry" ? queues.expiry : queues.notifications).send(msg, opts),
  }
}

/**
 * Fallback adapter: executes the job inline, immediately. Used in tests via
 * explicit fakes, and in runtimes without queue bindings so work is never
 * silently dropped — the mode is logged loudly at bind time.
 */
export function inlineJobProducer(
  deps: () => Promise<{ checkout: CheckoutRepository; sms: SmsProvider; email?: EmailProvider }>,
): JobProducer {
  return {
    publish: async (_queue, msg, opts) => {
      // A delayed payout can't wait inline; the seller's next visit to their
      // money page (or admin's "Pay everyone ready") pays it instead.
      if (msg.kind === "auto-payout" && (opts?.delaySeconds ?? 0) > 0) return
      const { checkout, sms, email } = await deps()
      await consumeJobMessage(
        { checkout, sms, email },
        msg,
        {
          attempts: 1,
          ack: () => {},
          retry: () => {
            throw new Error("inline producer cannot retry — configure queue bindings")
          },
        },
      )
    },
  }
}

/** Minimal ack/nack surface; the CF adapter maps real batch messages onto this. */
export type AckableJobMessage = {
  attempts: number
  ack: () => void
  retry: (opts?: { delaySeconds?: number }) => void
}

export type ConsumeDeps = {
  checkout: CheckoutRepository
  sms: SmsProvider
  /** Optional: absent → log stub (email outbox rows still drain). */
  email?: EmailProvider
  nowMs?: number
  /** Used to ask Paystack before expiring a checkout (absent → expire by clock). */
  paystackSecretKey?: string
  verifyPaystackTransaction?: VerifyPaystackTransaction
  emailLinks?: OrderEmailLinks
  jobs?: JobProducer
  /** Pays a seller's released money (automatic payouts); absent → ack and skip. */
  autoPay?: (sellerId: string) => Promise<unknown>
}

/** Mirrors the legacy sweep scope exactly: only non-terminal async (momo/card)
 * intents in initiated/pending can hold reservations worth releasing. COD
 * confirms inline; succeeded/completed/failed/refunded are owned by the
 * confirm/webhook paths — expiring them here would corrupt money. */
const EXPIRABLE_STATUS = new Set(["initiated", "pending"])
const EXPIRABLE_METHOD = new Set(["momo", "card"])

/** Exponential backoff in seconds from the docs' recommended shape (30s base). */
export function backoffDelaySeconds(attempts: number, baseSeconds = 30): number {
  return Math.min(baseSeconds ** Math.max(1, attempts), 24 * 3600)
}

async function consumeIntentExpiry(
  deps: ConsumeDeps,
  intentId: string,
  msg: AckableJobMessage,
): Promise<void> {
  const now = deps.nowMs ?? Date.now()
  const intent = await deps.checkout.getPaymentIntent(intentId)
  // Unknown, terminal, COD, or mid-confirm: redelivery converges to noop.
  if (
    !intent ||
    !EXPIRABLE_STATUS.has(intent.status) ||
    !EXPIRABLE_METHOD.has(intent.method)
  ) {
    msg.ack()
    return
  }
  // Rows predating createdAt are treated as stale (they can only be old).
  const ageMs = intent.createdAt ? now - intent.createdAt.getTime() : Number.POSITIVE_INFINITY
  if (ageMs >= PAYMENT_INTENT_STALE_AFTER_MS) {
    // Ask Paystack before expiring: a paid buyer must get their order.
    const result = await reconcileStaleIntent(deps.checkout, intent, {
      paystackSecretKey: deps.paystackSecretKey,
      verify: deps.verifyPaystackTransaction,
      emailLinks: deps.emailLinks,
      jobs: deps.jobs,
      nowMs: now,
    })
    if (result === "waiting") {
      msg.retry({ delaySeconds: 10 * 60 })
      return
    }
    msg.ack()
    return
  }
  // Early redelivery: come back when the intent is actually stale. No sweep needed.
  const remainingSec = Math.ceil((PAYMENT_INTENT_STALE_AFTER_MS - ageMs) / 1000)
  msg.retry({ delaySeconds: Math.max(60, remainingSec) })
}

/** Notification sweep: the outbox claim is the idempotency mechanism. */
async function consumeNotificationSweep(deps: ConsumeDeps, msg: AckableJobMessage): Promise<void> {
  await dispatchPendingNotifications(deps.checkout, deps.sms, { limit: 50 }, deps.email)
  msg.ack()
}

export async function consumeJobMessage(
  deps: ConsumeDeps,
  raw: unknown,
  msg: AckableJobMessage,
): Promise<void> {
  const parsed = JobMessageSchema.safeParse(raw)
  if (!parsed.success) throw new Error("unparseable job message — rides retries to the DLQ")
  if (parsed.data.kind === "intent-expiry") {
    await consumeIntentExpiry(deps, parsed.data.intentId, msg)
    return
  }
  if (parsed.data.kind === "auto-payout") {
    const now = deps.nowMs ?? Date.now()
    const waitSec = Math.ceil((parsed.data.notBeforeMs - now) / 1000)
    if (waitSec > 0) {
      const delaySeconds = Math.min(MAX_QUEUE_DELAY_SECONDS, Math.max(60, waitSec))
      // A fresh message, not a retry: retries are capped (max_retries) and a
      // 48h report window needs several 12h hops.
      if (deps.jobs) {
        await publishJob(deps.jobs, "expiry", parsed.data, { delaySeconds })
        msg.ack()
      } else msg.retry({ delaySeconds })
      return
    }
    await deps.autoPay?.(parsed.data.sellerId)
    msg.ack()
    return
  }
  await consumeNotificationSweep(deps, msg)
}
