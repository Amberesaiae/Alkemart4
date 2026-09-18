import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { categories } from "./categories"
import { sellers } from "./sellers"

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "proposed",
  "published",
  "rejected",
])

/** Canonical catalog content. Price and stock live on offers, never here. */
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: productStatusEnum("status").notNull().default("draft"),
  primaryCategoryId: text("primary_category_id")
    .notNull()
    .references(() => categories.id),
  sellerId: text("seller_id").references(() => sellers.id),
  /** Vendor-supplied image URL. Uploads are not on Workers yet; a pasted URL is honest media. */
  imageUrl: text("image_url"),
  /** Structured facts about the item ({label, value}[]), not variant axes. */
  attributes: jsonb("attributes").$type<{ label: string; value: string }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const productVariants = pgTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  sku: text("sku").unique(),
  title: text("title"),
})
