import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { sellers } from "./sellers"

/**
 * Blueprint Phase 4E — bulk import batches. The client-supplied import key
 * is unique per seller: replaying a key returns the stored summary without
 * creating duplicates. Rows always land in the review queue (proposed),
 * never directly published.
 */
export const vendorImports = pgTable(
  "vendor_imports",
  {
    id: text("id").primaryKey(),
    sellerId: text("seller_id")
      .notNull()
      .references(() => sellers.id),
    importKey: text("import_key").notNull(),
    rowCount: integer("row_count").notNull().default(0),
    createdCount: integer("created_count").notNull().default(0),
    success: integer("success").notNull().default(0),
    /** Stored per-row outcome so key replays answer identically. */
    summary: jsonb("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("vendor_imports_seller_key_uidx").on(table.sellerId, table.importKey)],
)
