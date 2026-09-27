import { bigint, boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { sellers } from "./sellers"

/** A listing's negotiation settings (0046). The floor is never shown to buyers. */
export const offerNegotiation = pgTable("offer_negotiation", {
  offerId: text("offer_id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  negotiable: boolean("negotiable").notNull().default(false),
  floorPesewas: bigint("floor_pesewas", { mode: "bigint" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** A buyer's price offer on one listing (0046). */
export const priceOffers = pgTable("price_offers", {
  id: text("id").primaryKey(),
  offerId: text("offer_id").notNull(),
  productId: text("product_id").notNull(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  buyerUserId: text("buyer_user_id").notNull(),
  buyerName: text("buyer_name"),
  qty: integer("qty").notNull().default(1),
  listPricePesewas: bigint("list_price_pesewas", { mode: "bigint" }).notNull(),
  amountPesewas: bigint("amount_pesewas", { mode: "bigint" }).notNull(),
  counterPesewas: bigint("counter_pesewas", { mode: "bigint" }),
  agreedPesewas: bigint("agreed_pesewas", { mode: "bigint" }),
  status: text("status").notNull().default("pending"),
  respondBy: timestamp("respond_by", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  usedIntentId: text("used_intent_id"),
  timeline: jsonb("timeline").$type<{ at: string; by: string; note: string }[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
