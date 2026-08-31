/**
 * Idempotent upsert of Ghana category tree (roots + L2 for phones/fashion/food).
 * Requires DATABASE_URL (or Hyperdrive connection string exported as DATABASE_URL).
 *
 *   bun run --cwd apps/api scripts/seed-categories.ts
 */
import { drizzle } from "drizzle-orm/postgres-js"
import { sql } from "drizzle-orm"
import postgres from "postgres"
import { categories, GHANA_CATEGORY_SEED } from "@alkemart/db"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.warn(
      "DATABASE_URL unset — skipping live category seed (fixture covered by domain tests).",
    )
    process.exit(0)
  }

  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  const roots = GHANA_CATEGORY_SEED.filter((r) => r.parentId === null)
  const children = GHANA_CATEGORY_SEED.filter((r) => r.parentId !== null)

  // Roots first so parent_id FKs resolve for L2 rows.
  for (const batch of [roots, children]) {
    if (batch.length === 0) continue
    await db
      .insert(categories)
      .values(batch)
      .onConflictDoUpdate({
        target: categories.handle,
        set: {
          name: sql`excluded.name`,
          rank: sql`excluded.rank`,
          parentId: sql`excluded.parent_id`,
          isNav: sql`excluded.is_nav`,
        },
      })
  }

  console.log(
    `Seeded ${GHANA_CATEGORY_SEED.length} categories (${roots.length} roots, ${children.length} L2).`,
  )
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
