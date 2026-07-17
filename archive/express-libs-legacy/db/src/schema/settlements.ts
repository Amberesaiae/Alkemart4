import { pgTable, text, serial, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vendorsTable } from "./vendors";
import { orderItemsTable } from "./orders";

/**
 * Settlement v1: manual ledger (ADR-009). One row per vendor per billing
 * period. Generated after fulfillment delivery; admin marks paid manually
 * before Paystack Transfer integration.
 */
export const SETTLEMENT_STATUSES = ["open", "ready", "paid", "void"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const vendorSettlementsTable = pgTable(
  "vendor_settlements",
  {
    id: serial("id").primaryKey(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendorsTable.id),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    grossPesewas: integer("gross_pesewas").notNull().default(0),
    commissionPesewas: integer("commission_pesewas").notNull().default(0),
    netPesewas: integer("net_pesewas").notNull().default(0),
    status: text("status").notNull().default("open").$type<SettlementStatus>(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidByUserId: integer("paid_by_user_id"),
    paystackTransferCode: text("paystack_transfer_code"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("vendor_settlements_vendor_period_unique").on(table.vendorId, table.periodStart, table.periodEnd),
    index("vendor_settlements_status_idx").on(table.status),
  ],
);

/**
 * Individual line items within a settlement. One row per order_item whose
 * vendor delivered during the period.
 */
export const vendorSettlementLinesTable = pgTable(
  "vendor_settlement_lines",
  {
    id: serial("id").primaryKey(),
    settlementId: integer("settlement_id")
      .notNull()
      .references(() => vendorSettlementsTable.id, { onDelete: "cascade" }),
    orderItemId: integer("order_item_id")
      .notNull()
      .references(() => orderItemsTable.id),
    orderId: integer("order_id").notNull(),
    itemSubtotalPesewas: integer("item_subtotal_pesewas").notNull(),
    commissionBpsSnapshot: integer("commission_bps_snapshot").notNull(),
    commissionPesewas: integer("commission_pesewas").notNull(),
    netPesewas: integer("net_pesewas").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("vendor_settlement_lines_settlement_idx").on(table.settlementId),
    index("vendor_settlement_lines_order_item_idx").on(table.orderItemId),
  ],
);

export const insertVendorSettlementSchema = createInsertSchema(vendorSettlementsTable).omit({
  id: true,
  createdAt: true,
  paidAt: true,
  paidByUserId: true,
  paystackTransferCode: true,
});
export const insertVendorSettlementLineSchema = createInsertSchema(vendorSettlementLinesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertVendorSettlement = z.infer<typeof insertVendorSettlementSchema>;
export type InsertVendorSettlementLine = z.infer<typeof insertVendorSettlementLineSchema>;
export type VendorSettlement = typeof vendorSettlementsTable.$inferSelect;
export type VendorSettlementLine = typeof vendorSettlementLinesTable.$inferSelect;
