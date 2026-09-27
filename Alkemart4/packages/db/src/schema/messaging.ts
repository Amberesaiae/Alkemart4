import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { sellers } from "./sellers"

/** Buyer ↔ seller conversation about one subject (0045). */
export const messageThreads = pgTable("message_threads", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  buyerUserId: text("buyer_user_id").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  /** `product:<id>`, `order:<id>` or `general`. */
  subject: text("subject").notNull(),
  productId: text("product_id"),
  orderId: text("order_id"),
  buyerReadAt: timestamp("buyer_read_at", { withTimezone: true }),
  sellerReadAt: timestamp("seller_read_at", { withTimezone: true }),
  blockedBy: text("blocked_by").$type<"buyer" | "seller" | "admin">(),
  reportedBy: text("reported_by").$type<"buyer" | "seller">(),
  reportReason: text("report_reason"),
  reportedAt: timestamp("reported_at", { withTimezone: true }),
  reportResolvedAt: timestamp("report_resolved_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => messageThreads.id, { onDelete: "cascade" }),
  sender: text("sender").$type<"buyer" | "seller">().notNull(),
  body: text("body").notNull(),
  flags: jsonb("flags").$type<{ phone: boolean; email: boolean; payOutside: boolean }>().notNull().default({ phone: false, email: false, payOutside: false }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

/** Public product questions, answered by the seller asked (0045). */
export const productQuestions = pgTable("product_questions", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  askerUserId: text("asker_user_id").notNull(),
  askerName: text("asker_name"),
  question: text("question").notNull(),
  answer: text("answer"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})
