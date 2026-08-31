import { bigint, boolean, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { productVariants, products } from "./products"
import { sellers } from "./sellers"

/** Sellable unit. available = on_hand - reserved is computed in domain, not stored. */
export const offers = pgTable(
  "offers",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariants.id),
    pricePesewas: bigint("price_pesewas", { mode: "bigint" }).notNull(),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    currency: text("currency").notNull().default("ghs"),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("offers_seller_product_variant_uidx").on(
      table.sellerId,
      table.productId,
      table.variantId,
    ),
  ],
)
