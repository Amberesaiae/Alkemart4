import { pgEnum, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"
import { sellers } from "./sellers"

export const userRoleEnum = pgEnum("user_role", ["buyer", "seller_member", "admin"])

export const sellerMemberRoleEnum = pgEnum("seller_member_role", ["owner", "staff"])

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const sellerMembers = pgTable(
  "seller_members",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    role: sellerMemberRoleEnum("role").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.sellerId] })],
)
