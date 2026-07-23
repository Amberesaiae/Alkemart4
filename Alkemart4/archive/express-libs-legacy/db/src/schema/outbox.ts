import { pgTable, text, serial, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Transactional outbox for domain events (ADR-010). Events are inserted within
 * the same DB transaction as the business operation (e.g. order confirm),
 * then processed asynchronously by a polling worker with SKIP LOCKED for
 * multi-instance safety. This replaces the in-process EventEmitter for
 * production durability.
 *
 * Handlers must be idempotent — at-least-once delivery means the same event
 * may be processed more than once (e.g. worker crash between marking done
 * and commit).
 */
export const DOMAIN_EVENT_NAMES = [
  "order.placed",
  "order.cancelled",
  "order.payment_pending",
  "order.payment_expired",
  "fulfillment.status_changed",
] as const;
export type DomainEventName = (typeof DOMAIN_EVENT_NAMES)[number];

export const domainEventOutboxTable = pgTable(
  "domain_event_outbox",
  {
    id: serial("id").primaryKey(),
    eventName: text("event_name").notNull().$type<DomainEventName>(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("domain_event_outbox_process_idx").on(table.processedAt, table.nextAttemptAt, table.id),
  ],
);

export const insertDomainEventOutboxSchema = createInsertSchema(domainEventOutboxTable).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  attempts: true,
  lastError: true,
  nextAttemptAt: true,
});
export type InsertDomainEventOutbox = z.infer<typeof insertDomainEventOutboxSchema>;
export type DomainEventOutbox = typeof domainEventOutboxTable.$inferSelect;
