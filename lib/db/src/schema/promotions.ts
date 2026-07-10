import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { usersTable } from "./users";

/**
 * Code-based discounts only (Medusa's Promotion module, trimmed down):
 * a shopper enters a `code` at checkout, and if it's active, within its date
 * window, and the cart meets `minOrderPesewas`, the discount is applied to
 * the order total. "Buy X get Y" / automatic (non-code) promotions are out
 * of scope for this pass.
 */
export const PROMOTION_DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type PromotionDiscountType = (typeof PROMOTION_DISCOUNT_TYPES)[number];

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull().$type<PromotionDiscountType>(),
  // For `percentage`, 1-100 (whole percent off). For `fixed`, a pesewas amount
  // to subtract from the subtotal (never below zero).
  value: integer("value").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  minOrderPesewas: integer("min_order_pesewas"),
  // Total number of times this code may ever be redeemed across all buyers;
  // null means unlimited. Enforced by counting `promotion_redemptions` rows.
  usageLimit: integer("usage_limit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * Append-only redemption ledger (one row per order a code was applied to),
 * rather than an in-place counter on `promotions` — this is what usage-limit
 * checks count against, and it keeps an auditable record of which order used
 * which code for how much of a discount.
 */
export const promotionRedemptionsTable = pgTable("promotion_redemptions", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id")
    .notNull()
    .references(() => promotionsTable.id, { onDelete: "cascade" }),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  buyerUserId: integer("buyer_user_id")
    .notNull()
    .references(() => usersTable.id),
  discountPesewas: integer("discount_pesewas").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPromotionRedemptionSchema = createInsertSchema(promotionRedemptionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type InsertPromotionRedemption = z.infer<typeof insertPromotionRedemptionSchema>;
export type Promotion = typeof promotionsTable.$inferSelect;
export type PromotionRedemption = typeof promotionRedemptionsTable.$inferSelect;
