import { integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Blueprint Phase 2 — search projection outbox, query vocabulary, telemetry.
 * Postgres is authoritative; the projection consumer rebuilds search
 * documents from these rows (ADR-005).
 */
export const outboxStatusEnum = pgEnum("outbox_status", ["pending", "claimed", "acked", "failed"])

export const searchOutbox = pgTable("search_outbox", {
  id: text("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  op: text("op").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: outboxStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
})

/** Alias/synonym/redirect governance (Phase 2C). Seller words become global only after review. */
export const aliasTypeEnum = pgEnum("alias_type", ["synonym", "redirect"])

export const aliasStatusEnum = pgEnum("alias_status", ["proposed", "approved", "rejected"])

export const searchAliases = pgTable("search_aliases", {
  id: text("id").primaryKey(),
  term: text("term").notNull(),
  target: text("target").notNull(),
  type: aliasTypeEnum("type").notNull(),
  status: aliasStatusEnum("status").notNull().default("proposed"),
  reviewerId: text("reviewer_id"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Zero-result and low-result telemetry feeding the search-quality queue (Phase 2D). */
export const searchQueryLog = pgTable("search_query_log", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  resultCount: integer("result_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
