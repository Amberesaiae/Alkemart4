import { sql } from "drizzle-orm"
import { bigint, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core"

export const sellerStatusEnum = pgEnum("seller_status", [
  "pending_approval",
  "open",
  "suspended",
  "terminated",
])

export const sellers = pgTable("sellers", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  status: sellerStatusEnum("status").notNull().default("pending_approval"),
  commissionBps: integer("commission_bps").notNull().default(700),
  deliveryFeePesewas: bigint("delivery_fee_pesewas", { mode: "bigint" }).notNull().default(sql`0`),
})
