import { type AnyPgColumn, boolean, integer, pgTable, text } from "drizzle-orm/pg-core"

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  parentId: text("parent_id").references((): AnyPgColumn => categories.id),
  rank: integer("rank").notNull().default(0),
  isNav: boolean("is_nav").notNull().default(true),
})
