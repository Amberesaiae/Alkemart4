import { bigint, boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
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
    // ── Phase 3A additions (nullable; unknown stays honest, never fabricated) ──
    /** `new` | `locally_used` | `refurbished` … governed per category. */
    condition: text("condition"),
    /** Real reference price; %-off labels require provenance (domain rule). */
    compareAtPesewas: bigint("compare_at_pesewas", { mode: "bigint" }),
    compareAtProvenance: text("compare_at_provenance"),
    /** Where fulfillment originates (shop/warehouse + area). */
    fulfillmentOrigin: text("fulfillment_origin"),
    warrantyRef: text("warranty_ref"),
    returnsRef: text("returns_ref"),
    deliveryPromise: text("delivery_promise"),
    /** Last verified price/stock signal; stale offers suppress. */
    freshnessAt: timestamp("freshness_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("offers_seller_product_variant_uidx").on(
      table.sellerId,
      table.productId,
      table.variantId,
    ),
    // Slice loaders filter offers by product (0028). The unique index above
    // is leftmost on seller_id, so it cannot serve product-only filters.
    index("offers_product_active_idx").on(table.productId, table.active),
  ],
)
