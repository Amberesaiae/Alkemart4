/**
 * Migration convention guard (see packages/db/src/migrations/README.md).
 *
 * Fails when:
 * - meta/_journal.json moved past the frozen 0017 entry (generate was run);
 * - migration numbering has gaps;
 * - a post-0017 migration uses non-idempotent DDL (bare CREATE TABLE,
 *   ADD COLUMN without IF NOT EXISTS, CREATE TYPE outside a
 *   duplicate_object guard).
 *
 * Run: bun scripts/check-migrations.ts (root: bun run check:migrations)
 */
import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "../packages/db/src/migrations")
const FROZEN_JOURNAL_TAG = "0017_option_value_images"
const HAND_WRITTEN_FROM = 18

let failures: string[] = []
const fail = (msg: string) => {
  failures.push(msg)
}

// 1. Journal frozen.
const journal = JSON.parse(
  readFileSync(join(ROOT, "meta/_journal.json"), "utf8"),
) as { entries: { tag: string }[] }
const last = journal.entries[journal.entries.length - 1]?.tag
if (last !== FROZEN_JOURNAL_TAG) {
  fail(
    `journal moved (last=${last}, frozen=${FROZEN_JOURNAL_TAG}). Hand-written SQL only — do not run drizzle-kit generate.`,
  )
}

// 2. Gapless numbering.
const files = readdirSync(ROOT)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort()
const nums = files.map((f) => Number(f.slice(0, 4)))
nums.forEach((n, i) => {
  if (n !== i) fail(`numbering gap: expected ${String(i).padStart(4, "0")}, files=${files.join(",")}`)
})

// 3. Idempotency for hand-written migrations.
for (const f of files) {
  const n = Number(f.slice(0, 4))
  if (n < HAND_WRITTEN_FROM) continue
  const sql = readFileSync(join(ROOT, f), "utf8")
  // Strip line comments to avoid false hits.
  const code = sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n")
  const bareCreateTable = code.match(/CREATE TABLE (?!\s*IF NOT EXISTS)/gi) ?? []
  if (bareCreateTable.length > 0) {
    fail(`${f}: ${bareCreateTable.length} bare CREATE TABLE (need IF NOT EXISTS)`)
  }
  const addColumn = code.match(/ADD COLUMN (?!\s*IF NOT EXISTS)/gi) ?? []
  if (addColumn.length > 0) {
    fail(`${f}: ${addColumn.length} ADD COLUMN without IF NOT EXISTS`)
  }
  // CREATE TYPE must live inside a DO block with a duplicate_object guard.
  const streets = code.split(/DO\s+\$\$/gi).length - 1
  const createTypes = code.match(/CREATE TYPE /gi) ?? []
  if (createTypes.length > streets) {
    fail(`${f}: CREATE TYPE outside a DO $$ … EXCEPTION WHEN duplicate_object guard`)
  }
  if (createTypes.length > 0 && !/duplicate_object/i.test(code)) {
    fail(`${f}: CREATE TYPE without duplicate_object guard`)
  }
}

if (failures.length > 0) {
  console.error("check-migrations FAILED:")
  for (const m of failures) console.error(` - ${m}`)
  process.exit(1)
}
console.log(`check-migrations OK (${files.length} files, journal frozen at ${FROZEN_JOURNAL_TAG})`)
