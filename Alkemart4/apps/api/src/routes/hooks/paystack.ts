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

  const dedup = c.get("webhookDedup")
  const dedupKey = `paystack:${event.data?.id ?? reference}:${event.event ?? "evt"}`
  if (dedup) {
    const seen = await dedup.get(dedupKey)
    if (seen) return c.json({ ok: true, deduped: true })
    await dedup.put(dedupKey, "1")
  }

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
    })
  } catch (err) {
    throw new HTTPException(502, {
      message: err instanceof Error ? err.message : "confirm failed",
    })
  }

  return c.json({ ok: true })
})
