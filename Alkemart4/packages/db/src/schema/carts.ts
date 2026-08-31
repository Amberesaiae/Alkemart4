import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { offers } from "./offers"
import { sellers } from "./sellers"

export const carts = pgTable("carts", {
  id: text("id").primaryKey(),
  currency: text("currency").notNull().default("ghs"),
  buyerEmail: text("buyer_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const cartItems = pgTable(
  "cart_items",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    qty: integer("qty").notNull(),
  },
  (table) => [uniqueIndex("cart_items_cart_offer_uidx").on(table.cartId, table.offerId)],
)
