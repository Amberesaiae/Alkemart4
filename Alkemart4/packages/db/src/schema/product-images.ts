import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { products } from "./products"

/**
 * Ordered product gallery (migration 0032).
 *
 * `products.imageUrl` remains the primary image and the legacy fallback: a
 * product with no rows here still renders its single image, so nothing had to
 * be backfilled for old catalogue rows to keep working.
 */
export const productImages = pgTable(
  "product_images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** Nullable on purpose — an invented alt is worse than none. */
    alt: text("alt"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("product_images_product_position_idx").on(t.productId, t.position),
    uniqueIndex("product_images_product_url_key").on(t.productId, t.url),
  ],
)
