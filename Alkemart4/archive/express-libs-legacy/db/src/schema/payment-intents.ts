import { pgTable, text, serial, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";

/**
 * Payment intent tracks the lifecycle of an external charge (Paystack MoMo)
 * from initiation through confirmation or failure. The intent row is created
 * BEFORE the Paystack HTTP call so a crash between charge response and DB
 * persist can be recovered by the orphan/recovery worker.
 *
 * `clientReference` is a server-generated UUID set at insert time — it serves
 * as a durable join key before any external I/O. `providerReference` is
 * populated after Paystack returns a reference (may be null until then).
 */
export const PAYMENT_INTENT_STATUSES = ["initiated", "pending", "succeeded", "failed", "expired"] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const paymentIntentsTable = pgTable(
  "payment_intents",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("paystack"),
    /** Server-generated UUID before any Paystack call — durable join key. */
    clientReference: text("client_reference").notNull().unique(),
    /** Paystack's returned reference — nullable until charge response persists. */
    providerReference: text("provider_reference"),
    amountPesewas: integer("amount_pesewas").notNull(),
    currency: text("currency").notNull().default("GHS"),
    status: text("status").notNull().default("initiated").$type<PaymentIntentStatus>(),
    /** Last raw status string from Paystack (for debugging). */
    rawLastStatus: text("raw_last_status"),
    /** Charge reference from Paystack response, stored for webhook/verify join. */
    providerChargeRef: text("provider_charge_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    /** TTL-based expiry — set at pending create; used by abandonment sweeper. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    unique("payment_intents_provider_reference_unique").on(table.provider, table.providerReference),
    index("payment_intents_order_id_idx").on(table.orderId),
    index("payment_intents_client_reference_idx").on(table.clientReference),
    index("payment_intents_status_expires_idx").on(table.status, table.expiresAt),
  ],
);

export const insertPaymentIntentSchema = createInsertSchema(paymentIntentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;
export type PaymentIntent = typeof paymentIntentsTable.$inferSelect;
