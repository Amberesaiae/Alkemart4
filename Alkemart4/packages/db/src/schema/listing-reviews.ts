import { jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core"
import { products } from "./products"

/** Listing review history (0038): every submit, rule, AI and admin decision. */
export const listingReviews = pgTable("listing_reviews", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  reviewer: text("reviewer").notNull(),
  reviewerId: text("reviewer_id"),
  reasons: jsonb("reasons").$type<{ code: string; message: string; field?: string }[]>().notNull().default([]),
  note: text("note"),
  model: text("model"),
  confidence: real("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Operator switches without a deploy (0038). */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
})
