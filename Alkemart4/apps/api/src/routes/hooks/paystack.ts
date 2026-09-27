import { verifyPaystackWebhookSignature } from "@alkemart/paystack"
import { payoutStatusFromTransfer } from "@alkemart/domain"
import { orderEmailLinks } from "../../lib/order-emails"
import { autoPayAfter } from "../../lib/payouts"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { confirmCheckoutFromPaystack, PaidAfterCloseError } from "../../lib/checkout-confirm"
import type { AppEnv } from "../../context"
import type { CheckoutRepository, PaystackEventRow, ReturnCaseRow } from "../../checkout-repository"

type PaystackEvent = {
  event?: string
  data?: {
    id?: number | string
    reference?: string
    amount?: number
    currency?: string
    status?: string
    reason?: string
    gateway_response?: string | null
    transfer_code?: string
    // disputes / refunds carry the charge under `transaction`
    transaction?: { reference?: string }
    /** refund.* events */
    transaction_reference?: string
    refund_reference?: string
  }
}

/** Record what we did with an event. Never lets logging break the webhook. */
async function logEvent(checkout: CheckoutRepository, e: PaystackEvent, outcome: string, detail: string | null = null) {
  const d = e.data ?? {}
  const reference = d.reference ?? d.transaction?.reference ?? null
  const row: Omit<PaystackEventRow, "receivedAt"> = {
    id: `${e.event ?? "event"}:${d.id ?? reference ?? crypto.randomUUID()}`,
    event: e.event ?? "unknown",
    reference,
    amountMinor: typeof d.amount === "number" && Number.isInteger(d.amount) ? BigInt(d.amount) : null,
    currency: d.currency ?? null,
    status: d.status ?? null,
    outcome,
    detail,
  }
  try {
    await checkout.recordPaystackEvent(row)
  } catch (err) {
    console.error(JSON.stringify({ job: "paystack-event-log", error: err instanceof Error ? err.message : String(err) }))
  }
}

/**
 * A refund we sent for a return: mark it paid or failed. Matched by the
 * refund id Paystack gave us, else by the charge reference and amount.
 * Returns the case id, or null when it isn't one of ours.
 */
async function settleReturnRefund(checkout: CheckoutRepository, e: PaystackEvent): Promise<string | null> {
  const d = e.data ?? {}
  const status = e.event === "refund.processed" ? "paid" : e.event === "refund.failed" ? "failed" : null
  if (!status) return null
  const pending = await checkout.listReturnCases({ refundPending: true }).catch((): ReturnCaseRow[] => [])
  const txRef = d.transaction_reference ?? d.transaction?.reference ?? null
  let hit = pending.find((r) => r.refundRef && (r.refundRef === String(d.id ?? "") || r.refundRef === d.refund_reference))
  if (!hit && txRef && typeof d.amount === "number") {
    for (const r of pending) {
      if (r.refundPesewas !== BigInt(d.amount)) continue
      const order = await checkout.getOrder(r.orderId).catch(() => null)
      const group = order ? await checkout.getOrderGroup(order.orderGroupId).catch(() => null) : null
      const intent = group ? await checkout.getPaymentIntent(group.paymentIntentId).catch(() => null) : null
      if (intent?.paystackReference === txRef) {
        hit = r
        break
      }
    }
  }
  if (!hit) return null
  await checkout.setReturnRefund(hit.id, {
    status,
    entry: { by: "system", note: status === "paid" ? "Refund reached the buyer" : "The refund failed — alkemart will send it again" },
  })
  return hit.id
}

/**
 * Paystack webhooks. Signature first (HMAC-SHA512 over the raw body with
 * the secret key), then:
 *   charge.success / paymentrequest.success → confirm the order (verified
 *     by reference: status, amount and currency)
 *   transfer.success / failed / reversed → settle the payout
 *   charge.dispute.* / refund.* → logged for admins (alerts)
 * Every signed event is recorded with what we did. Anything that can't
 * succeed on retry is acknowledged (200) and raised as an alert instead of
 * making Paystack retry for 72 hours.
 */
export const paystackHooks = new Hono<AppEnv>().post("/", async (c) => {
  const rawBody = await c.req.text()
  const signature = c.req.header("x-paystack-signature") ?? ""
  const secret = c.get("paystackSecretKey")
  if (!secret) {
    throw new HTTPException(503, { message: "PAYSTACK_SECRET_KEY is not configured" })
  }
  if (!verifyPaystackWebhookSignature(rawBody, signature, secret)) {
    throw new HTTPException(401, { message: "invalid signature" })
  }

  let event: PaystackEvent
  try {
    event = JSON.parse(rawBody) as PaystackEvent
  } catch {
    throw new HTTPException(400, { message: "invalid json" })
  }
  const checkout = c.get("checkoutRepo")
  const eventName = event.event ?? ""

  // ── Payouts ────────────────────────────────────────────────────────────
  if (eventName === "transfer.success" || eventName === "transfer.failed" || eventName === "transfer.reversed") {
    const reference = event.data?.reference
    const payout = reference ? await checkout.getPayoutByReference(reference) : null
    if (!payout) {
      await logEvent(checkout, event, "ignored", "no payout with this reference")
      return c.json({ ok: true, ignored: "unknown transfer" })
    }
    const amount = event.data?.amount
    if (typeof amount === "number" && BigInt(amount) !== payout.netPesewas) {
      await logEvent(checkout, event, "alert:amount_mismatch", `payout ${payout.id} expected ${payout.netPesewas}, Paystack sent ${amount}`)
      return c.json({ ok: true, alert: "amount mismatch" })
    }
    const to = payoutStatusFromTransfer(eventName.slice("transfer.".length))
    if (to !== "paid" && to !== "failed" && to !== "reversed") {
      await logEvent(checkout, event, "ignored")
      return c.json({ ok: true })
    }
    const reason = to === "paid" ? null : (event.data?.gateway_response || event.data?.reason || `Paystack: transfer ${to}`)
    const { changed } = await checkout.settlePayout(payout.id, to, {
      actor: "paystack",
      reason,
      transferCode: event.data?.transfer_code ?? null,
    })
    await logEvent(checkout, event, changed ? "settled" : "duplicate", `payout ${payout.id} → ${to}`)
    // One payout in flight per seller: once this one lands, send whatever was
    // released meanwhile (automatic payouts). Never on failure — that would
    // loop on a bad MoMo account; admin sees failures instead.
    if (changed && to === "paid") await autoPayAfter(c, payout.sellerId)
    return c.json({ ok: true })
  }

  // ── Disputes & refunds: people must look at these ──────────────────────
  if (eventName.startsWith("charge.dispute.")) {
    await logEvent(checkout, event, "alert:dispute", event.data?.reason ?? null)
    return c.json({ ok: true })
  }
  if (eventName.startsWith("refund.")) {
    const matched = await settleReturnRefund(checkout, event)
    await logEvent(
      checkout,
      event,
      eventName === "refund.failed" ? "alert:refund_failed" : "refund",
      [event.data?.status ?? null, matched ? `return ${matched}` : null].filter(Boolean).join(" · ") || null,
    )
    return c.json({ ok: true })
  }

  // ── Charges ────────────────────────────────────────────────────────────
  const reference = event.data?.reference
  if (!reference) {
    return c.json({ ok: true, ignored: true })
  }
  if (eventName && eventName !== "charge.success" && eventName !== "paymentrequest.success") {
    await logEvent(checkout, event, "ignored")
    return c.json({ ok: true, ignored: eventName })
  }

  const dedup = c.get("webhookDedup")
  const dedupKey = `paystack:${event.data?.id ?? reference}:${eventName || "evt"}`
  if (dedup) {
    const seen = await dedup.get(dedupKey)
    if (seen) return c.json({ ok: true, deduped: true })
  }
  // Without KV (tests/local), correctness still holds: status updates are
  // compare-and-swap and order_groups.payment_intent_id is unique, so a
  // duplicate delivery resolves to the winner's group instead of double
  // confirmation. KV here is purely a fast path.

  const intent = await checkout.getPaymentIntentByReference(reference)
  if (!intent) {
    await logEvent(checkout, event, "alert:unknown_reference", "a successful charge we have no checkout for")
    return c.json({ ok: true, ignored: "unknown reference" })
  }

  try {
    await confirmCheckoutFromPaystack(checkout, {
      paymentIntentId: intent.id,
      paystackSecretKey: secret,
      verify: c.get("verifyPaystackTransaction"),
      jobs: c.get("jobs"),
      emailLinks: orderEmailLinks(c),
    })
  } catch (err) {
    if (err instanceof PaidAfterCloseError) {
      // Retrying can't fix this — a person must refund or fulfil.
      await logEvent(checkout, event, "alert:paid_after_close", `checkout was ${err.intentStatus}; stock was released`)
      return c.json({ ok: true, alert: "paid after close" })
    }
    // Deliberately do NOT mark the event seen: Paystack must be free to
    // retry. Marking before confirming would turn one transient failure into
    // a permanently unconfirmed paid order.
    await logEvent(checkout, event, "retrying", err instanceof Error ? err.message : "confirm failed")
    throw new HTTPException(502, {
      message: err instanceof Error ? err.message : "confirm failed",
    })
  }
  await logEvent(checkout, event, "confirmed")

  // Fast path only — correctness already rests on CAS status updates and the
  // unique order_groups.payment_intent_id. TTL keeps KV from growing forever.
  if (dedup) {
    await dedup.put(dedupKey, "1", { expirationTtl: 60 * 60 * 24 * 7 })
  }

  return c.json({ ok: true })
})
