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
