import { pgTable, text } from "drizzle-orm/pg-core"

export const markets = pgTable("markets", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  currency: text("currency").notNull(),
  name: text("name").notNull(),
})
