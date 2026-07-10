import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Fixed set of triggered notification types for this pass (see Order
 * notifications task scope) — a preferences/subscription system can widen
 * this later without a schema change, since `data` is already an open bag.
 */
export const NOTIFICATION_TYPES = ["order.confirmed", "order.new_for_vendor"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * In-app notification record (Medusa's Notification module pattern,
 * implemented natively): an event subscriber writes a row here per
 * recipient, decoupled from actual delivery. `data` is an open JSON bag
 * (e.g. `{ orderId, totalPesewas }`) so the UI can render type-specific
 * copy/links without new columns per notification type. A future
 * email/SMS provider would read from the same event subscriber rather than
 * this table, so adding one never changes how in-app notifications work.
 */
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<NotificationType>(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
