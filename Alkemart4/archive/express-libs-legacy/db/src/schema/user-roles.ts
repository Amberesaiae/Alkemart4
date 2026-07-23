import { pgTable, text, serial, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vendorsTable } from "./vendors";

export const ROLES = ["buyer", "vendor_owner", "vendor_staff", "admin", "support_agent"] as const;
export type Role = (typeof ROLES)[number];

export const userRolesTable = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<Role>(),
    vendorId: integer("vendor_id").references(() => vendorsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The unique constraint on (user_id, role, vendor_id) already provides a
    // left-prefix index usable for user_id lookups, so no separate
    // user_roles_user_id_idx is needed.
    unique().on(table.userId, table.role, table.vendorId),
    index("user_roles_vendor_id_idx").on(table.vendorId),
  ],
);

export const insertUserRoleSchema = createInsertSchema(userRolesTable).omit({ id: true, createdAt: true });
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRolesTable.$inferSelect;
