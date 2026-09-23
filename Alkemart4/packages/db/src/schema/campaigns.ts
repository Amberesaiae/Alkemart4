import { bigint, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { products } from "./products"
import { sellers } from "./sellers"

/**
 * Blueprint Phase 5A — campaign engine entities (ADR-004).
 * Placements are the fixed inventory; campaigns compete for them through
 * reviewed statuses; eligibility is re-evaluated at serve time so stale or
 * ineligible products fall out instead of rendering broken promises.
 */

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "review",
  "scheduled",
  "live",
  "ended",
])

export const campaignObjectiveEnum = pgEnum("campaign_objective", [
  "sale",
  "launch",
  "clearance",
  "brand",
])

/** Fixed inventory slots. Seeded, not user-created: the page has N slots. */
export const placements = pgTable("placements", {
  code: text("code").primaryKey(),
  /** Human job for this slot (e.g. "Homepage hero"). */
  job: text("job").notNull(),
  /** Max simultaneously live campaigns fighting for this slot. */
  maxLive: integer("max_live").notNull().default(1),
  /** Machine constraints checked at serve time (e.g. min products). */
  constraints: jsonb("constraints"),
})

export const promotionTerms = pgTable("promotion_terms", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  summary: text("summary").notNull(),
  finePrint: text("fine_print"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Stable external reference for attribution. */
  trackingId: text("tracking_id").notNull().unique(),
  objective: campaignObjectiveEnum("objective").notNull().default("sale"),
  placementCode: text("placement_code")
    .notNull()
    .references(() => placements.code),
  status: campaignStatusEnum("status").notNull().default("draft"),
  priority: integer("priority").notNull().default(0),
  /** Paid placement: buyers see a Sponsored label, never silent replacement. */
  sponsored: integer("sponsored").notNull().default(0),
  frequencyCap: integer("frequency_cap"),
  termsId: text("terms_id").references(() => promotionTerms.id),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const creatives = pgTable("creatives", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  /** Responsive slot: desktop and mobile art are separate records. */
  slot: text("slot").notNull().default("desktop"),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url"),
  link: text("link"),
  position: integer("position").notNull().default(0),
})

export const productSets = pgTable("product_sets", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  name: text("name").notNull(),
})

export const productSetItems = pgTable(
  "product_set_items",
  {
    id: text("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => productSets.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    position: integer("position").notNull().default(0),
  },
  (table) => [uniqueIndex("product_set_items_uidx").on(table.setId, table.productId)],
)

export const sellerSets = pgTable("seller_sets", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  name: text("name").notNull(),
})

export const sellerSetItems = pgTable(
  "seller_set_items",
  {
    id: text("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => sellerSets.id),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    position: integer("position").notNull().default(0),
  },
  (table) => [uniqueIndex("seller_set_items_uidx").on(table.setId, table.sellerId)],
)

export const campaignAudit = pgTable("campaign_audit", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  actor: text("actor"),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const campaignEventEnum = pgEnum("campaign_event", ["view", "select"])

/**
 * Phase 5D — promotion measurement without PII. Views and selects keyed by
 * campaign/placement/creative/position only; revenue attribution rides
 * Phase 7 journeys.
 */
export const campaignEvents = pgTable("campaign_events", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  placementCode: text("placement_code").notNull(),
  creativeId: text("creative_id"),
  position: integer("position"),
  event: campaignEventEnum("event").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
