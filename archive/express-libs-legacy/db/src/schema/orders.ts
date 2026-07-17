import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";
import { productsTable } from "./products";
import { addressesTable } from "./addresses";

/**
 * Order status lifecycle. `pending` covers the brief window while a checkout
 * workflow is running; today's synchronous (no live payment gateway) checkout
 * moves straight to `confirmed` on success within the same transaction.
 * `fulfilled` and `cancelled` are terminal states future fulfillment/refund
 * work will transition orders into.
 */
export const ORDER_STATUSES = ["pending", "confirmed", "fulfilled", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Payment events are an append-only ledger (Medusa-style) rather than a
 * single mutable `paymentStatus` column, so a future real payment gateway
 * integration (auth → capture → refund, webhooks) can append new events
 * without a schema rewrite. Today only a single synthetic `paid` event is
 * recorded per order (no live processor — see commerce-core task scope).
 */
export const ORDER_PAYMENT_EVENT_TYPES = ["paid", "refunded", "failed", "cod_pending", "payment_pending", "refund_failed"] as const;
export type OrderPaymentEventType = (typeof ORDER_PAYMENT_EVENT_TYPES)[number];

/**
 * How the buyer chose to settle this order. `momo` orders are charged
 * up-front through Paystack (MTN MoMo / Vodafone Cash / AirtelTigo Money)
 * before the order is created; `cash_on_delivery` orders are confirmed
 * immediately with payment collected by the courier on delivery.
 */
export const ORDER_PAYMENT_METHODS = ["momo", "cash_on_delivery"] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

/**
 * `subtotalPesewas`/`totalPesewas` are a computed financial snapshot stored
 * on the order row at checkout time (Medusa's "order summary" pattern),
 * rather than re-derived from order_items on every read — order totals must
 * stay stable even if a product's price changes later.
 */
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  buyerUserId: integer("buyer_user_id")
    .notNull()
    .references(() => usersTable.id),
  status: text("status").notNull().default("pending").$type<OrderStatus>(),
  subtotalPesewas: integer("subtotal_pesewas").notNull(),
  // `discountPesewas` + `promotionCode` are a snapshot of any promotion
  // applied at checkout time (denormalized, like the price/title snapshots
  // on order_items) so the order stays an accurate historical record even if
  // the promotion is later edited or deactivated. `totalPesewas` already has
  // the discount subtracted; `discountPesewas` is kept alongside it purely
  // for display/audit ("you saved GHS X").
  discountPesewas: integer("discount_pesewas").notNull().default(0),
  promotionCode: text("promotion_code"),
  totalPesewas: integer("total_pesewas").notNull(),
  // The delivery address is referenced (not just embedded) so buyers can
  // still edit their address book freely, but ON DELETE RESTRICT keeps any
  // address that's actually been used on an order from disappearing out
  // from under that order's history.
  addressId: integer("address_id").references(() => addressesTable.id, { onDelete: "restrict" }),
  paymentMethod: text("payment_method").$type<OrderPaymentMethod>(),
  /** When a pending MoMo payment expires — set at pending create; used by TTL sweeper. */
  paymentExpiresAt: timestamp("payment_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("orders_buyer_user_id_idx").on(table.buyerUserId),
  index("orders_address_id_idx").on(table.addressId),
  index("orders_status_idx").on(table.status),
  index("orders_payment_expires_idx").on(table.paymentExpiresAt),
]);

/**
 * Line items snapshot product title/price at purchase time so an order
 * remains an accurate historical record even if the product is later
 * edited, deactivated, or deleted. `vendorId` is denormalized here (not
 * just reachable via productId) so vendor/admin order queries never need to
 * join through a possibly-deleted product row.
 */
export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => vendorsTable.id),
  titleSnapshot: text("title_snapshot").notNull(),
  pricePesewasSnapshot: integer("price_pesewas_snapshot").notNull(),
  qty: integer("qty").notNull(),
  subtotalPesewas: integer("subtotal_pesewas").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
  index("order_items_product_id_idx").on(table.productId),
  index("order_items_vendor_id_idx").on(table.vendorId),
]);

export const orderPaymentEventsTable = pgTable("order_payment_events", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<OrderPaymentEventType>(),
  amountPesewas: integer("amount_pesewas").notNull(),
  provider: text("provider"),
  providerReference: text("provider_reference"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("order_payment_events_order_id_idx").on(table.orderId),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true, createdAt: true });
export const insertOrderPaymentEventSchema = createInsertSchema(orderPaymentEventsTable).omit({ id: true, createdAt: true });

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type InsertOrderPaymentEvent = z.infer<typeof insertOrderPaymentEventSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type OrderPaymentEvent = typeof orderPaymentEventsTable.$inferSelect;
