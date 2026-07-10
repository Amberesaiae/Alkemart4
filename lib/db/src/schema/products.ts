import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vendorsTable } from "./vendors";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  brand: text("brand"),
  description: text("description"),
  pricePesewas: integer("price_pesewas").notNull(),
  compareAtPesewas: integer("compare_at_pesewas"),
  stock: integer("stock").notNull().default(0),
  // Reserved units held by in-flight/completed orders, tracked separately
  // from `stock` (Medusa-style inventory reservation pattern) so
  // `availableQuantity = stock - reservedStock` can be checked atomically
  // against concurrent checkouts without overselling. Today's synchronous
  // checkout reserves and immediately converts to a real `stock` decrement
  // in the same DB transaction, but the columns stay separate so a future
  // async payment/fulfillment flow (reserve now, decrement on fulfillment)
  // doesn't need a schema change.
  reservedStock: integer("reserved_stock").notNull().default(0),
  tag: text("tag"),
  attributes: jsonb("attributes").$type<Record<string, unknown>>(),
  ratingAvgX100: integer("rating_avg_x100").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
