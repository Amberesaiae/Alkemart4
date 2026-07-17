import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const VENDOR_STATUSES = ["active", "suspended"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ratingAvgX100: integer("rating_avg_x100").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  badgeTopSeller: boolean("badge_top_seller").notNull().default(false),
  badgeFastShipper: boolean("badge_fast_shipper").notNull().default(false),
  bio: text("bio"),
  paystackRecipientCode: text("paystack_recipient_code"),
  commissionBps: integer("commission_bps").notNull().default(700),
  status: text("status").notNull().default("active").$type<VendorStatus>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
