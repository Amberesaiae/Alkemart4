import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { vendorsTable } from "./vendors";

/**
 * Internal shipment/delivery status tracker only (no external carrier
 * integration — rate calc / label printing is out of scope). One row per
 * (order, vendor) pair rather than per order_item, since an order's line
 * items from the same vendor always ship together in this model; a vendor
 * advances a single status for all of their items on a given order.
 */
export const FULFILLMENT_STATUSES = ["unfulfilled", "packed", "shipped", "delivered"] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/** Valid forward-only transitions; enforced in the route handler, not just the DB. */
export const FULFILLMENT_STATUS_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  unfulfilled: ["packed"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
};

export const fulfillmentsTable = pgTable(
  "fulfillments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendorsTable.id),
    status: text("status").notNull().default("unfulfilled").$type<FulfillmentStatus>(),
    packedAt: timestamp("packed_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [unique("fulfillments_order_vendor_unique").on(table.orderId, table.vendorId)],
);

export const insertFulfillmentSchema = createInsertSchema(fulfillmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFulfillment = z.infer<typeof insertFulfillmentSchema>;
export type Fulfillment = typeof fulfillmentsTable.$inferSelect;
