import {
  assertPaystackAmountMatches,
  assertPaystackCurrencyMatches,
  verifyPaystackTransaction,
  type PaystackConfig,
} from "@alkemart/paystack"
import type { CheckoutRepository } from "../checkout-repository"
import { notificationSweepMessage, publishJob, type JobProducer } from "../jobs"
import { enqueueOrderPlacedEmails, type OrderEmailLinks } from "./order-emails"

export type VerifyPaystackTransaction = typeof verifyPaystackTransaction

/**
 * Paystack says the buyer paid, but we had already closed this checkout
 * (expired/failed) and released the stock. Creating the order blindly could
 * oversell; ignoring it keeps the buyer's money. It becomes an admin alert
 * (refund or fulfil by hand) and the webhook is acknowledged so Paystack
 * stops retrying.
 */
export class PaidAfterCloseError extends Error {
  constructor(
    readonly intentId: string,
    readonly intentStatus: string,
  ) {
    super(`paid after checkout was ${intentStatus}`)
    this.name = "PaidAfterCloseError"
  }
}

/** Idempotent: verify Paystack amount then create OrderGroup (or no-op if already created). */
export async function confirmCheckoutFromPaystack(
  checkout: CheckoutRepository,
  opts: {
    paymentIntentId: string
    paystackSecretKey: string
    verify?: VerifyPaystackTransaction
    /** When present, a notification sweep is published after confirm. */
    jobs?: JobProducer
    /** When present, buyer/seller order emails are enqueued (idempotent keys). */
    emailLinks?: OrderEmailLinks
  },
) {
  const intent = await checkout.getPaymentIntent(opts.paymentIntentId)
  if (!intent) throw new Error("payment intent not found")
  if (!intent.paystackReference) throw new Error("missing paystack reference")

  const existing = await checkout.getOrderGroupByPaymentIntent(intent.id)
  if (existing) {
    return {
      orderGroup: existing,
      orders: await checkout.listOrdersForGroup(existing.id),
      alreadyConfirmed: true,
    }
  }

  const verify = opts.verify ?? verifyPaystackTransaction
  const cfg: PaystackConfig = { secretKey: opts.paystackSecretKey }
  const verified = await verify(cfg, intent.paystackReference)
  if (verified.status !== "success") {
    throw new Error(`Paystack status not success: ${verified.status}`)
  }
  assertPaystackAmountMatches(intent.amountPesewas, verified.amount)
  assertPaystackCurrencyMatches(intent.currency, verified.currency)
  if (intent.status === "expired" || intent.status === "failed") {
    throw new PaidAfterCloseError(intent.id, intent.status)
  }

  if (intent.status === "pending") {
    await checkout.updatePaymentIntentStatus(intent.id, "succeeded")
  }
  const result = await checkout.confirmPaidOrder(intent.id)
  if (opts.emailLinks) {
    await enqueueOrderPlacedEmails(checkout, { group: result.orderGroup, orders: result.orders, method: intent.method, links: opts.emailLinks })
  }
  if (opts.jobs) await publishJob(opts.jobs, "notifications", notificationSweepMessage())
  return { ...result, alreadyConfirmed: false }
}
