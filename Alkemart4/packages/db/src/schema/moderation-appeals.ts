import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { products } from "./products"
import { sellers } from "./sellers"

export const appealStatusEnum = pgEnum("appeal_status", ["open", "closed"])
export const appealDecisionEnum = pgEnum("appeal_decision", ["reopened", "upheld"])

/** Seller appeals against product rejections. One open appeal per product. */
export const moderationAppeals = pgTable("moderation_appeals", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  message: text("message").notNull(),
  status: appealStatusEnum("status").notNull().default("open"),
  decision: appealDecisionEnum("decision"),
  response: text("response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
})
