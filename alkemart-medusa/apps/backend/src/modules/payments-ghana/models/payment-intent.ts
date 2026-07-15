import { model } from "@medusajs/framework/utils"

/**
 * Payment intent tracks external charge lifecycle (Paystack MoMo, etc.).
 *
 * ADR-014: create with server-generated client_reference BEFORE any Paystack
 * HTTP call. provider_reference is set after the provider responds.
 *
 * Money: amount_pesewas is always integer minor units (1 GHS = 100 pesewas).
 */
const PaymentIntent = model.define("payment_intent", {
  id: model.id().primaryKey(),
  cart_id: model.text().nullable(),
  order_id: model.text().nullable(),
  /** Server-generated UUID — durable join key before external I/O. */
  client_reference: model.text().unique(),
  /** Provider charge reference — nullable until charge response persists. */
  provider_reference: model.text().nullable(),
  amount_pesewas: model.number(),
  currency: model.text().default("ghs"),
  /** initiated | pending | succeeded | failed | expired */
  status: model.text().default("initiated"),
  expires_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
})

export default PaymentIntent
