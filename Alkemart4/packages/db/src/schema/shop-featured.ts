import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { products } from "./products"
import { sellers } from "./sellers"

/**
 * Vendor-curated featured shelf. Rank is the array position (1-based);
 * at most 8 rows per seller. Replaced wholesale on every vendor save.
 */
export const shopFeatured = pgTable("shop_featured", {
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
