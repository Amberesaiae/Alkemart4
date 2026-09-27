import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * 0040: newsletter subscribers, double opt-in. `pending` until the person
 * clicks the signed confirm link; only `confirmed` addresses are mailed.
 * Unsubscribing keeps the row (so we never re-add them by accident).
 */
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  email: text("email").primaryKey(),
  status: text("status").notNull().default("pending"),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
})
