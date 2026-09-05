import { bigint, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { carts } from "./carts"
import { offers } from "./offers"

export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "initiated",
  "pending",
  "succeeded",
  "completed",
  "failed",
  "expired",
  "refunded",
])

export const paymentMethodEnum = pgEnum("payment_method", ["momo", "card", "cod"])

export const paymentIntents = pgTable("payment_intents", {
  id: text("id").primaryKey(),
  cartId: text("cart_id")
    .notNull()
    .references(() => carts.id),
  method: paymentMethodEnum("method").notNull(),
  status: paymentIntentStatusEnum("status").notNull(),
  amountPesewas: bigint("amount_pesewas", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull().default("ghs"),
  paystackReference: text("paystack_reference").unique(),
  buyerEmail: text("buyer_email").notNull(),
  momoProvider: text("momo_provider"),
  momoPhone: text("momo_phone"),
  /** Buyer delivery address captured at checkout (CheckoutAddress snake_case). */
  shippingAddress: jsonb("shipping_address").$type<{
    first_name: string
    last_name: string
    phone: string
    address_1: string
    address_2?: string
    city: string
    province?: string
    country_code: string
    postal_code?: string
  } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: text("id").primaryKey(),
    paymentIntentId: text("payment_intent_id")
      .notNull()
      .references(() => paymentIntents.id),
    offerId: text("offer_id")
      .notNull()
      .references(() => offers.id),
    qty: integer("qty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("stock_reservations_intent_offer_uidx").on(table.paymentIntentId, table.offerId),
  ],
)
