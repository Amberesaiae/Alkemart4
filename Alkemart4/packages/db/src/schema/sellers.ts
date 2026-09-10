import { sql } from "drizzle-orm"
import { bigint, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const sellerStatusEnum = pgEnum("seller_status", [
  "pending_approval",
  "open",
  "suspended",
  "terminated",
])

export const sellerAvailabilityEnum = pgEnum("seller_availability", ["open", "paused"])

export const sellers = pgTable("sellers", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  logo: text("logo"),
  banner: text("banner"),
  status: sellerStatusEnum("status").notNull().default("pending_approval"),
  commissionBps: integer("commission_bps").notNull().default(700),
  deliveryFeePesewas: bigint("delivery_fee_pesewas", { mode: "bigint" }).notNull().default(sql`0`),
  recipientCode: text("recipient_code"),
  momoProvider: text("momo_provider"),
  momoPhone: text("momo_phone"),
  packRegion: text("pack_region"),
  digitalAddress: text("digital_address"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  availability: sellerAvailabilityEnum("availability").notNull().default("open"),
  pausedUntil: timestamp("paused_until", { withTimezone: true }),
  pauseNote: text("pause_note"),
})
