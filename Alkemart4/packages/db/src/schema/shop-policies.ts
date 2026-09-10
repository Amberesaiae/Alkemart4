import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import { sellers } from "./sellers"

/**
 * Append-only shop policy versions. Every vendor save inserts a new row;
 * the highest version is the policy in force.
 * body: { shipping?: string, returnsDays?: number, warranty?: string }
 */
export const shopPolicyVersions = pgTable("shop_policy_versions", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .notNull()
    .references(() => sellers.id),
  version: integer("version").notNull(),
  body: jsonb("body").$type<{ shipping?: string; returnsDays?: number; warranty?: string }>().notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
})
