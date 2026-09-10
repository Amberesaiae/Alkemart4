import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { orders } from "./orders"
import { products } from "./products"
import { sellers } from "./sellers"

export const reviewStatusEnum = pgEnum("review_status", ["pending", "published", "hidden"])

/**
 * Buyer-written reviews (verified purchase only: one per order, order must
 * be delivered). Vendors get one response each; admins publish or hide.
 */
export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => orders.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  buyerEmail: text("buyer_email").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  status: reviewStatusEnum("status").notNull().default("pending"),
  vendorResponse: text("vendor_response"),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
