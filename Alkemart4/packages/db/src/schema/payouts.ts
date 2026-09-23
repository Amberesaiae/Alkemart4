import { bigint, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { orders } from "./orders"
import { sellers } from "./sellers"

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "processing",
  "paid",
  "failed",
])

export const payouts = pgTable("payouts", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  status: payoutStatusEnum("status").notNull().default("pending"),
  grossPesewas: bigint("gross_pesewas", { mode: "bigint" }).notNull(),
  commissionPesewas: bigint("commission_pesewas", { mode: "bigint" }).notNull(),
  netPesewas: bigint("net_pesewas", { mode: "bigint" }).notNull(),
  commissionBps: integer("commission_bps").notNull(),
  paystackTransferCode: text("paystack_transfer_code"),
  paystackReference: text("paystack_reference").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const payoutLines = pgTable("payout_lines", {
  id: text("id").primaryKey(),
  payoutId: text("payout_id")
    .notNull()
    .references(() => payouts.id),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id)
    .unique(),
  grossPesewas: bigint("gross_pesewas", { mode: "bigint" }).notNull(),
  commissionPesewas: bigint("commission_pesewas", { mode: "bigint" }).notNull(),
  netPesewas: bigint("net_pesewas", { mode: "bigint" }).notNull(),
})

export const payoutHoldStatusEnum = pgEnum("payout_hold_status", ["held", "released"])

/**
 * Blueprint Phase 4D — payout holds with reasons. A held order's net is
 * excluded from payable totals until an admin releases it; every hold and
 * release names its actor. No silent holds.
 */
export const payoutHolds = pgTable("payout_holds", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  orderId: text("order_id").references(() => orders.id),
  amountPesewas: bigint("amount_pesewas", { mode: "bigint" }),
  reason: text("reason").notNull(),
  status: payoutHoldStatusEnum("status").notNull().default("held"),
  createdBy: text("created_by"),
  releasedBy: text("released_by"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const returnStatusEnum = pgEnum("return_status", [
  "requested",
  "approved",
  "rejected",
  "refunded",
])

export const returns = pgTable("returns", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  status: returnStatusEnum("status").notNull().default("requested"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
