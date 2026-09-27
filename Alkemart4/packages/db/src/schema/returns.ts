import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { orders } from "./orders"
import { sellers } from "./sellers"

/** One step on a return's timeline. */
export type ReturnTimelineEntry = { at: string; by: "buyer" | "seller" | "admin" | "system"; status: string; note: string }

/** Returns and disputes (0044). One open case per order at a time. */
export const returnCases = pgTable("return_cases", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  buyerEmail: text("buyer_email").notNull(),
  reason: text("reason").notNull(),
  wish: text("wish").$type<"refund" | "swap">().notNull(),
  note: text("note").notNull(),
  status: text("status").notNull().default("requested"),
  respondBy: timestamp("respond_by", { withTimezone: true }),
  declineReason: text("decline_reason"),
  outcome: text("outcome"),
  refundPesewas: bigint("refund_pesewas", { mode: "bigint" }).notNull().default(0n),
  refundVia: text("refund_via").$type<"provider" | "seller">(),
  refundStatus: text("refund_status").$type<"pending" | "paid" | "failed" | "owed">(),
  refundRef: text("refund_ref"),
  sellerRecoveryPesewas: bigint("seller_recovery_pesewas", { mode: "bigint" }).notNull().default(0n),
  recoveredPayoutId: text("recovered_payout_id"),
  adminNote: text("admin_note"),
  timeline: jsonb("timeline").$type<ReturnTimelineEntry[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
})
