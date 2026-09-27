import { bigint, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { offers } from "./offers"
import { paymentIntents } from "./payments"
import { products } from "./products"
import { sellers } from "./sellers"

export const orderStatusEnum = pgEnum("order_status", [
  "placed",
  "shipped",
  "delivered",
  "cancelled",
])

export const orderGroups = pgTable("order_groups", {
  id: text("id").primaryKey(),
  paymentIntentId: text("payment_intent_id")
    .notNull()
    .unique()
    .references(() => paymentIntents.id),
  buyerEmail: text("buyer_email").notNull(),
  totalPesewas: bigint("total_pesewas", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull().default("ghs"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderGroupId: text("order_group_id")
    .notNull()
    .references(() => orderGroups.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  subtotalPesewas: bigint("subtotal_pesewas", { mode: "bigint" }).notNull(),
  deliveryFeePesewas: bigint("delivery_fee_pesewas", { mode: "bigint" }).notNull(),
  status: orderStatusEnum("status").notNull().default("placed"),
  /** Frozen at checkout from the seller's delivery settings (0036). */
  dispatchBy: timestamp("dispatch_by", { withTimezone: true }),
  deliverEarliest: timestamp("deliver_earliest", { withTimezone: true }),
  deliverLatest: timestamp("deliver_latest", { withTimezone: true }),
  /** Delivery or pickup, chosen by the buyer at checkout (0042). */
  fulfillmentMethod: text("fulfillment_method").$type<"delivery" | "pickup">().notNull().default("delivery"),
  deliveryZone: text("delivery_zone").$type<"town" | "region" | "country">(),
  /** 4-digit code the buyer gives at handover; the seller never sees it (0042). */
  handoverCode: text("handover_code"),
  handoverFailures: integer("handover_failures").notNull().default(0),
  /** Buyer proof ("buyer_code" / "buyer") or the seller's word ("seller") (0042). */
  deliveryConfirmedBy: text("delivery_confirmed_by").$type<"buyer_code" | "buyer" | "seller">(),
  /** Online payout for this order is released from here; null = legacy, payable. */
  payoutReleaseAt: timestamp("payout_release_at", { withTimezone: true }),
  /** Items refunded to the buyer so far; payouts pay only what's left (0044). */
  refundedPesewas: bigint("refunded_pesewas", { mode: "bigint" }).notNull().default(0n),
})

/** Append-only status history — the order timeline (0036). */
export const orderEvents = pgTable("order_events", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  status: orderStatusEnum("status").notNull(),
  actor: text("actor").notNull(),
  actorId: text("actor_id"),
  note: text("note"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
})

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  offerId: text("offer_id")
    .notNull()
    .references(() => offers.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  title: text("title").notNull(),
  qty: integer("qty").notNull(),
  unitPricePesewas: bigint("unit_price_pesewas", { mode: "bigint" }).notNull(),
})
