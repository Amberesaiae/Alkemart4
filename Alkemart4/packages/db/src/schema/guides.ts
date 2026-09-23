import { integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Blueprint Phase 6E — editorial guides (hub-and-spoke).
 * Prose never embeds prices, stock, or product IDs: sections reference
 * live catalog queries (category + search terms) resolved at serve time,
 * so buying advice cannot go stale. Drafts schedule like everything else;
 * `refreshAfter` drives the editorial refresh rota.
 */

export const guideStatusEnum = pgEnum("guide_status", ["draft", "published"])

export const guides = pgTable("guides", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  author: text("author").notNull(),
  status: guideStatusEnum("status").notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  /** [{ heading, body, picks: [{ label?, categoryHandle?, query?, limit? }] }] */
  sections: jsonb("sections").notNull().default([]),
  relatedGuides: jsonb("related_guides").notNull().default([]),
  refreshAfter: timestamp("refresh_after", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
