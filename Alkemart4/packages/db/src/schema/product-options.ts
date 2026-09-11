import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { products, productVariants } from "./products"

/** Vendor-defined option types per product (e.g. Size, Colour). Max 2. */
export const productOptions = pgTable("product_options", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Allowed values per option type (e.g. S, M, L). */
export const productOptionValues = pgTable("product_option_values", {
  id: text("id").primaryKey(),
  optionId: text("option_id")
    .notNull()
    .references(() => productOptions.id),
  value: text("value").notNull(),
  position: integer("position").notNull().default(0),
})

/** Combo membership: which values make up a variant. */
export const variantOptionValues = pgTable("variant_option_values", {
  id: text("id").primaryKey(),
  variantId: text("variant_id")
    .notNull()
    .references(() => productVariants.id),
  valueId: text("value_id")
    .notNull()
    .references(() => productOptionValues.id),
})
