---
name: Schema file drifting from live DB column names
description: A Drizzle schema.ts can declare a column name that no longer matches the actual Postgres column, causing silent 500s at query time.
---

The `disputes` table's real Postgres column was `order_ref`, but `lib/db/src/schema/disputes.ts` declared it as `order_id` (`orderId: integer("order_id")`). Drizzle trusts the schema file, so every query referencing `disputesTable.orderId` (or the raw column) threw "column does not exist" at runtime — TypeScript gave no warning since the field name (`orderId`) was consistent, only the SQL column string was wrong.

**Why:** schema.ts is hand-authored and can fall out of sync with the live DB (e.g. after a manual rename or partial migration); nothing enforces they match at compile time.

**How to apply:** when a query against a table 500s with a Postgres "column ... does not exist" error, don't assume the app code is wrong — check the live DB's actual columns first (`information_schema.columns`) and compare against the schema.ts declaration before touching call sites. Fix the schema.ts column string, then rebuild the package's dist (`tsc -b --force` in that lib) so consumers pick up the corrected type/column mapping.
