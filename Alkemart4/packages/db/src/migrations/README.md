# Migrations convention (pinned 2026-09-21)

## The rule: hand-written numbered SQL only, journal frozen

`meta/_journal.json` is **frozen at `0017_option_value_images`**. Do not append
to it. Do not run `drizzle-kit generate`.

**Why:** `0018_content_pages.sql` and `0019_product_attributes.sql` were
hand-written and never journaled. With the journal behind the directory,
`generate` diffs the live schema files against the stale `0017` snapshot and
emits a **full-baseline migration** (`CREATE TABLE` for every table, no
`IF NOT EXISTS`). Applying that to any existing database fails at best and
destroys data at worst. Demonstrated 2026-09-21: generated output was deleted
unapplied; see commit `0eaeb1e`.

## Writing a migration

1. Next sequential number: `NNNN_short-slug.sql` (currently `0021_` next).
2. **Idempotent only**, so it is safe on databases at any earlier level:
   - `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`
   - `CREATE TABLE IF NOT EXISTS …`
   - Types via `DO $$ BEGIN CREATE TYPE … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
   - New columns nullable or defaulted — legacy readers must not break.
3. New tables/columns need matching Drizzle schema exports in `../schema/`
   (schema is the query-time contract; SQL is the apply-time contract — keep
   both, per `.agents/memory/schema-vs-live-db-drift.md` check live columns
   when a query 500s on "column does not exist").
4. Apply path: `packages/db` Drizzle migrate when `DATABASE_URL` is reachable,
   else admin one-shot endpoints (see root `DEPLOYMENT.md`).

## Guard

`scripts/check-migrations.ts` (root `bun run check:migrations`) enforces this:
journal frozen, numbering gapless, idempotency patterns present. Run it in CI.
