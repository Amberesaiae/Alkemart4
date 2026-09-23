import { bigint, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { offers } from "./offers"
import { products } from "./products"
import { sellers } from "./sellers"

/**
 * Blueprint Phase 7 — lifecycle growth foundations.
 * Preferences gate every send by category; subscriptions fire one-shot;
 * experiments assign deterministically with logged exposure.
 */

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    channel: text("channel").notNull().default("sms"),
    category: text("category").notNull(),
    topic: text("topic"),
    optedIn: integer("opted_in").notNull().default(1),
    frequencyCap: integer("frequency_cap"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // NULL topics must still collide: a buyer holds one row per category.
    uniqueIndex("notification_preferences_owner_uidx").on(
      table.ownerType,
      table.ownerId,
      table.channel,
      table.category,
      sql`coalesce(${table.topic}, '')`,
    ),
  ],
)

export const stockSubscriptions = pgTable(
  "stock_subscriptions",
  {
    id: text("id").primaryKey(),
    buyerEmail: text("buyer_email").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    offerId: text("offer_id").references(() => offers.id),
    kind: text("kind").notNull(),
    belowPesewas: bigint("below_pesewas", { mode: "bigint" }),
    channel: text("channel").notNull().default("sms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("stock_subscriptions_offer_idx").on(table.offerId)],
)

export const experimentStatusEnum = pgEnum("experiment_status", [
  "draft",
  "running",
  "paused",
  "ended",
])

export const experiments = pgTable("experiments", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: experimentStatusEnum("status").notNull().default("draft"),
  controlPct: integer("control_pct").notNull().default(50),
  primaryMetric: text("primary_metric"),
  guardrails: jsonb("guardrails"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const experimentExposures = pgTable(
  "experiment_exposures",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiments.id),
    unitId: text("unit_id").notNull(),
    bucket: text("bucket").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("experiment_exposures_uidx").on(table.experimentId, table.unitId)],
)
