import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";
import { ordersTable } from "./orders";

export const DISPUTE_STATUSES = ["open", "resolved_buyer", "resolved_seller"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const disputesTable = pgTable("disputes", {
  id: serial("id").primaryKey(),
  // References the real order this dispute is about. `onDelete: "restrict"`
  // keeps an order that has an open dispute from disappearing out from under
  // it (mirrors how order_items/addresses protect order history elsewhere).
  orderId: integer("order_ref")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "restrict" }),
  vendorId: integer("vendor_id").references(() => vendorsTable.id, { onDelete: "set null" }),
  buyerUserId: integer("buyer_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open").$type<DisputeStatus>(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDisputeSchema = createInsertSchema(disputesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputesTable.$inferSelect;
