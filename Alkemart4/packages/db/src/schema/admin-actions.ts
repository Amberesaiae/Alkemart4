import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./users"

/** Append-only audit trail of consequential admin actions. */
export const adminActions = pgTable("admin_actions", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
