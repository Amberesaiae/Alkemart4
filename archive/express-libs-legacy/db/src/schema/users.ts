import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  /** ISO 3166-1 alpha-2 (e.g. GH). Defaults to Ghana for existing accounts. */
  countryCode: text("country_code").notNull().default("GH"),
  /** ISO 4217 (e.g. GHS). Display/checkout preference; catalog remains GHS today. */
  preferredCurrency: text("preferred_currency").notNull().default("GHS"),
  /** BCP 47 locale tag (e.g. en-GH). */
  locale: text("locale").notNull().default("en-GH"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
