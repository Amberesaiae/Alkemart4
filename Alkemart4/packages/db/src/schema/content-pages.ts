import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const contentPages = pgTable("content_pages", {
  key: text("key").primaryKey(),
  revision: integer("revision").notNull().default(1),
  draftSections: jsonb("draft_sections").$type<unknown[]>().notNull().default([]),
  publishedSections: jsonb("published_sections").$type<unknown[]>().notNull().default([]),
  scheduledSections: jsonb("scheduled_sections").$type<unknown[] | null>(),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  unpublishAt: timestamp("unpublish_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
