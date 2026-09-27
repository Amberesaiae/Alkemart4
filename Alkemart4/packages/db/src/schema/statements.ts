import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/** Frozen monthly statements (0043). Never updated once written. */
export const statements = pgTable("statements", {
  id: text("id").primaryKey(),
  scope: text("scope").$type<"seller" | "platform">().notNull(),
  /** '' for the platform statement. */
  sellerId: text("seller_id").notNull().default(""),
  period: text("period").notNull(),
  data: jsonb("data").notNull(),
  hash: text("hash").notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
})
