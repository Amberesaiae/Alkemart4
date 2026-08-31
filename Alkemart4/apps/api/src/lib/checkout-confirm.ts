import {
  assertPaystackAmountMatches,
  verifyPaystackTransaction,
  type PaystackConfig,
} from "@alkemart/paystack"
import type { CheckoutRepository } from "../checkout-repository"

export type VerifyPaystackTransaction = typeof verifyPaystackTransaction

/** Idempotent: verify Paystack amount then create OrderGroup (or no-op if already created). */
export async function confirmCheckoutFromPaystack(
  checkout: CheckoutRepository,
  opts: {
    paymentIntentId: string
    paystackSecretKey: string
    verify?: VerifyPaystackTransaction
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

  if (intent.status === "pending") {
    await checkout.updatePaymentIntentStatus(intent.id, "succeeded")
  }
  const result = await checkout.confirmPaidOrder(intent.id)
  return { ...result, alreadyConfirmed: false }
}
