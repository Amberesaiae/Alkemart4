import postgres from "postgres"
import { readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { MIGRATIONS_TABLE, pendingMigrations } from "../packages/db/src/migration-plan"

/**
 * Owned idempotent migration runner (agnostic plan Phase 6). Applies
 * `packages/db/src/migrations/*.sql` in lexicographic order, tracking state
 * in `schema_migrations` — works on any Postgres, any host, no journal, no
 * vendor. Complements `scripts/check-migrations.ts`, which guards the
 * frozen-journal + idempotency conventions. Every file must be re-runnable.
 *
 * Usage: DATABASE_URL=<direct or session-mode URL> bun run db:migrate
 * (Pooler transaction mode can reject multi-statement DDL — prefer the
 * direct `db.<ref>.supabase.co:5432` URL or a session pooler.)
 */
const ROOT = resolve(import.meta.dir, "../packages/db/src/migrations")

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")
  const sql = postgres(url, { max: 1 })
  try {
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    )
    const applied = (
      (await sql.unsafe(`SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version`)) as unknown as {
        version: string
      }[]
    ).map((r) => r.version)
    const pending = pendingMigrations(applied, readdirSync(ROOT))
    for (const version of pending) {
      // One tx per file: DDL here is transactional (no CONCURRENTLY in the
      // tree), so a failing file leaves prior files intact. Versions derive
      // from our own filenames, never user input.
      await sql.begin(async (tx) => {
        await tx.file(join(ROOT, `${version}.sql`))
        await tx.unsafe(`INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ('${version}')`)
      })
      console.log(JSON.stringify({ job: "migrate", applied: version }))
    }
    console.log(JSON.stringify({ job: "migrate", pending: pending.length, done: true }))
  } finally {
    await sql.end()
  }
}

await main()
