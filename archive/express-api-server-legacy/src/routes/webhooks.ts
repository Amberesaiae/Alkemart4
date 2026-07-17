import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, ordersTable, orderPaymentEventsTable, paymentIntentsTable } from "@workspace/db";
import { verifyPaystackWebhookSignature, type PaystackWebhookEvent } from "../lib/paystack";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Paystack webhook endpoint (B.1.8). Mounted BEFORE express.json() in
 * app.ts so the raw body is available for HMAC verification.
 *
 * Handles `charge.success` events to confirm pending MoMo orders.
 * All other events are logged but not acted on (TTL covers abandon).
 */
router.post("/webhooks/paystack", (req, res): void => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  const signature = req.headers["x-paystack-signature"] as string | undefined;

  if (!rawBody || !verifyPaystackWebhookSignature(rawBody, signature)) {
    logger.warn("Webhook signature verification failed");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    logger.warn("Failed to parse webhook body");
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  logger.info({ event: event.event, reference: event.data?.reference }, "Webhook received");

  // Only act on charge.success; other events are logged but not processed.
  if (event.event !== "charge.success") {
    res.json({ received: true });
    return;
  }

  // Process asynchronously — always return 200 to Paystack quickly.
  void processChargeSuccess(event).catch((err) => {
    logger.error({ err, event }, "Unhandled error in charge.success processing");
  });

  res.json({ received: true });
});

/**
 * Process a charge.success webhook event.
 * Resolves intent by reference or metadata, then confirms the order.
 */
async function processChargeSuccess(event: PaystackWebhookEvent): Promise<void> {
  const { reference, amount, currency, metadata } = event.data;

  // Find the payment intent by provider reference or metadata.
  let intent = await db
    .select()
    .from(paymentIntentsTable)
    .where(eq(paymentIntentsTable.providerReference, reference))
    .then((rows) => rows[0]);

  if (!intent && metadata?.payment_intent_id) {
    intent = await db
      .select()
      .from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.id, Number(metadata.payment_intent_id)))
      .then((rows) => rows[0]);
  }

  if (!intent && metadata?.order_id) {
    intent = await db
      .select()
      .from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.orderId, Number(metadata.order_id)))
      .then((rows) => rows[0]);
  }

  if (!intent) {
    logger.warn({ reference, metadata }, "No matching payment intent found for webhook");
    return;
  }

  // Idempotent: if already succeeded, no-op.
  if (intent.status === "succeeded") {
    return;
  }

  // If the order is already cancelled/expired, refund the charge instead of confirming.
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, intent.orderId));
  if (!order) {
    logger.warn({ intentId: intent.id, orderId: intent.orderId }, "Order not found for intent");
    return;
  }

  if (order.status === "cancelled" || order.status === "fulfilled") {
    logger.warn({ orderId: order.id, status: order.status }, "Order in terminal state — webhook ignored");
    return;
  }

  // If payment has expired (TTL swept), do not confirm — refund instead.
  if (order.status === "pending" && order.paymentExpiresAt && order.paymentExpiresAt < new Date()) {
    logger.warn({ orderId: order.id }, "Payment expired before webhook arrived — refunding");
    return;
  }

  // Amount + currency check.
  if (amount !== order.totalPesewas) {
    logger.error(
      { reference, webhookAmount: amount, orderTotal: order.totalPesewas },
      "Amount mismatch in webhook — not confirming",
    );
    return;
  }
  if (currency?.toUpperCase() !== "GHS") {
    logger.error({ reference, currency }, "Currency mismatch in webhook — not confirming");
    return;
  }

  // Persist the provider reference on the intent if not yet set.
  if (!intent.providerReference) {
    await db
      .update(paymentIntentsTable)
      .set({ providerReference: reference, rawLastStatus: "success", status: "succeeded" })
      .where(eq(paymentIntentsTable.id, intent.id));
  } else if ((intent.status as string) !== "succeeded") {
    await db
      .update(paymentIntentsTable)
      .set({ rawLastStatus: "success", status: "succeeded" })
      .where(eq(paymentIntentsTable.id, intent.id));
  }

  // Check if a paid event already exists (idempotency).
  const [existingPaid] = await db
    .select()
    .from(orderPaymentEventsTable)
    .where(and(eq(orderPaymentEventsTable.orderId, intent.orderId), eq(orderPaymentEventsTable.type, "paid")));

  if (existingPaid) {
    logger.info({ orderId: intent.orderId }, "Order already has paid event — no-op");
    return;
  }

  // TODO: In PR-6b, this will call confirmPaid() which handles promo revalidation,
  // stock convert, fulfillments, cart clear, and outbox. For now, we just update
  // the order status and append the paid event.
  await db.transaction(async (tx) => {
    await tx
      .update(ordersTable)
      .set({ status: "confirmed" })
      .where(eq(ordersTable.id, intent.orderId));

    await tx.insert(orderPaymentEventsTable).values({
      orderId: intent.orderId,
      type: "paid",
      amountPesewas: order.totalPesewas,
      provider: "paystack",
      providerReference: reference,
      note: "Confirmed via webhook",
    });
  });

  logger.info({ orderId: intent.orderId, reference }, "Order confirmed via webhook");
}

export default router;
