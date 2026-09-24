import { sql } from "drizzle-orm"
import {
  bigint,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

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
  /**
   * Pinpoint shop location (migration 0035). Region answers "same region or
   * not"; coordinates answer "how far", which is what near-me and
   * deliverability ranking actually need. Null until the seller drops a pin.
   */
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  /** Device-reported accuracy in metres — shown for transparency, not ranked on. */
  locationAccuracyM: integer("location_accuracy_m"),
  locationSetAt: timestamp("location_set_at", { withTimezone: true }),
  district: text("district"),
  digitalAddress: text("digital_address"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  availability: sellerAvailabilityEnum("availability").notNull().default("open"),
  pausedUntil: timestamp("paused_until", { withTimezone: true }),
  pauseNote: text("pause_note"),
})
