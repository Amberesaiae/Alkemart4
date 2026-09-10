import { date, integer, pgTable, text } from "drizzle-orm/pg-core"
import { products } from "./products"
import { sellers } from "./sellers"

/** Day-grain shop/product view counters (privacy-light: no visitor identity). */
export const shopViews = pgTable("shop_views", {
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  productId: text("product_id").references(() => products.id),
  day: date("day", { mode: "date" }).notNull(),
  views: integer("views").notNull().default(0),
})
