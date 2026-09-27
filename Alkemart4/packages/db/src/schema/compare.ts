import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/** ⚖ compare tokens per buyer (0048). Credits, not money. */
export const compareWallets = pgTable("compare_wallets", {
  userId: text("user_id").primaryKey(),
  balance: integer("balance").notNull(),
  refilledAt: timestamp("refilled_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

/** A comparison a buyer opened (one token), kept so reopening it is free. */
export const comparisons = pgTable("comparisons", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  productIds: text("product_ids").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
