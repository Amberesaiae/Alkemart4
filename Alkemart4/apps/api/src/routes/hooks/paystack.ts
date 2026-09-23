import { verifyPaystackWebhookSignature } from "@alkemart/paystack"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { confirmCheckoutFromPaystack } from "../../lib/checkout-confirm"
import type { AppEnv } from "../../context"

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

  let event: {
    event?: string
    data?: { reference?: string; id?: number | string }
  }
  try {
    event = JSON.parse(rawBody) as typeof event
  } catch {
    throw new HTTPException(400, { message: "invalid json" })
  }

  const reference = event.data?.reference
  if (!reference) {
    return c.json({ ok: true, ignored: true })
  }

  const eventName = event.event ?? ""
  // Only success charge events should confirm orders.
  if (
    eventName &&
    eventName !== "charge.success" &&
    eventName !== "paymentrequest.success"
  ) {
    if (eventName === "charge.failed" || eventName === "paymentrequest.failed") {
      const checkout = c.get("checkoutRepo")
      const intent = await checkout.getPaymentIntentByReference(reference)
      if (intent && intent.status === "pending") {
        try {
          await checkout.updatePaymentIntentStatus(intent.id, "failed")
          await checkout.releaseReservations(intent.id)
        } catch {
          /* ignore transition races */
        }
      }
      return c.json({ ok: true, failed: true })
    }
    return c.json({ ok: true, ignored: eventName })
  }

  const dedup = c.get("webhookDedup")
  const dedupKey = `paystack:${event.data?.id ?? reference}:${eventName || "evt"}`
  if (dedup) {
    const seen = await dedup.get(dedupKey)
    if (seen) return c.json({ ok: true, deduped: true })
    await dedup.put(dedupKey, "1")
  }
  // Without KV (tests/local), correctness still holds: status updates are
  // compare-and-swap and order_groups.payment_intent_id is unique, so a
  // duplicate delivery resolves to the winner's group instead of double
  // confirmation. KV here is purely a fast path.

  const checkout = c.get("checkoutRepo")
  const intent = await checkout.getPaymentIntentByReference(reference)
  if (!intent) {
    return c.json({ ok: true, ignored: "unknown reference" })
  }

  try {
    await confirmCheckoutFromPaystack(checkout, {
      paymentIntentId: intent.id,
      paystackSecretKey: secret,
      verify: c.get("verifyPaystackTransaction"),
      jobs: c.get("jobs"),
    })
  } catch (err) {
    throw new HTTPException(502, {
      message: err instanceof Error ? err.message : "confirm failed",
    })
  }

  return c.json({ ok: true })
})
