import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"])

/**
 * SMS outbox for fulfillment events. Idempotency key = `${orderId}:${status}`
 * (unique) so retries and double-fires never text a buyer twice.
 */
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  channel: text("channel").notNull().default("sms"),
  recipient: text("recipient").notNull(),
  body: text("body").notNull(),
  /** Phase 7A send classification: transactional|promotional|operational. */
  category: text("category").notNull().default("transactional"),
  status: notificationStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
})
