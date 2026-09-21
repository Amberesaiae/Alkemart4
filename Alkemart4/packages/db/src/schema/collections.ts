import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { products } from "./products"
import { sellers } from "./sellers"

/**
 * Blueprint Phase 4A — vendor collections (ADR-003).
 * Seller-owned merchandising; many-to-many with products; never alters
 * canonical classification.
 */
export const collectionVisibilityEnum = pgEnum("collection_visibility", [
  "draft",
  "published",
])

export const collections = pgTable("collections", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  visibility: collectionVisibilityEnum("visibility").notNull().default("draft"),
  position: integer("position").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const collectionProducts = pgTable(
  "collection_products",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    uniqueIndex("collection_products_uidx").on(
      table.collectionId,
      table.productId,
    ),
  ],
)
