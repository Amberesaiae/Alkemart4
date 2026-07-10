import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * A buyer's saved delivery address. `digitalAddress` is the Ghana Post GPS
 * digital address (e.g. "GA-183-1234") — the de facto standard for precise
 * delivery in Ghana where street addresses are often ambiguous. It's
 * optional (not every buyer has looked theirs up) but surfaced prominently
 * in the UI since it materially improves delivery accuracy.
 */
export const addressesTable = pgTable("addresses", {
  id: serial("id").primaryKey(),
  buyerUserId: integer("buyer_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  label: text("label"),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  city: text("city").notNull(),
  region: text("region"),
  digitalAddress: text("digital_address"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("addresses_buyer_user_id_idx").on(table.buyerUserId),
]);

export const insertAddressSchema = createInsertSchema(addressesTable).omit({
  id: true,
  buyerUserId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type Address = typeof addressesTable.$inferSelect;
