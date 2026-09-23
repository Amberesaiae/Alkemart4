import postgres from "postgres"
import { describe, expect, it } from "vitest"

/**
 * RLS tenant-isolation matrix (migration 0029). Live-DB test: every insert
 * runs inside one transaction that is always rolled back, so the real
 * database is never polluted. Skips (rather than fails) without
 * DATABASE_URL_POOLER — CI without a database stays green.
 *
 * Run: DATABASE_URL_POOLER=<pooler, no ?sslmode> bun run test:rls
 */
// Minimal env access: the api package is Workers-typed (no node types).
declare const process: { env: Record<string, string | undefined> } | undefined
const DB_URL = ((typeof process !== "undefined" ? process.env.DATABASE_URL_POOLER : "") ?? "").replace(
  /\?sslmode=require$/,
  "",
)
const LIVE = DB_URL.length > 0

class Rollback extends Error {}

async function inRolledBackTx(fn: (tx: postgres.TransactionSql) => Promise<void>) {
  let last: unknown = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const sql = postgres(DB_URL, { ssl: "require", max: 1, connect_timeout: 25 })
    try {
      await sql.begin(async (tx) => {
        await fn(tx as unknown as postgres.TransactionSql)
        throw new Rollback()
      })
      return
    } catch (error) {
      if (error instanceof Rollback) return
      last = error
      const transient = /CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|ENOTFOUND/.test(
        error instanceof Error ? error.message : String(error),
      )
      if (!transient) throw error
      await new Promise((r) => setTimeout(r, 5000 * attempt))
    } finally {
      await sql.end()
    }
  }
  throw last
}

describe.runIf(LIVE)("rls tenant isolation", () => {
  it("seller A sees only A's rows; cross writes fail; owner sees all", async () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    const cat = `rls-cat-${suffix}`
    const [sa, sb] = [`rls-a-${suffix}`, `rls-b-${suffix}`]
    const [prod, va, vb, oa, ob] = [
      `rls-p-${suffix}`,
      `rls-va-${suffix}`,
      `rls-vb-${suffix}`,
      `rls-oa-${suffix}`,
      `rls-ob-${suffix}`,
    ]
    await inRolledBackTx(async (tx) => {
      await tx.unsafe(`INSERT INTO categories (id, handle, name) VALUES ('${cat}', '${cat}', 'rls')`)
      for (const [id, handle] of [[sa, sa], [sb, sb]] as const) {
        await tx.unsafe(
          `INSERT INTO sellers (id, handle, name, status) VALUES ('${id}', '${handle}', '${handle}', 'open')`,
        )
      }
      await tx.unsafe(
        `INSERT INTO products (id, title, status, primary_category_id) VALUES ('${prod}', 'rls', 'published', '${cat}')`,
      )
      for (const [id] of [[va], [vb]] as const) {
        await tx.unsafe(`INSERT INTO product_variants (id, product_id) VALUES ('${id}', '${prod}')`)
      }
      await tx.unsafe(
        `INSERT INTO offers (id, seller_id, product_id, variant_id, price_pesewas, on_hand) VALUES ('${oa}', '${sa}', '${prod}', '${va}', 1000, 5)`,
      )
      await tx.unsafe(
        `INSERT INTO offers (id, seller_id, product_id, variant_id, price_pesewas, on_hand) VALUES ('${ob}', '${sb}', '${prod}', '${vb}', 2000, 5)`,
      )

      // Fence to seller A: only A's offer visible; B's untouchable.
      await tx.unsafe(`SET ROLE seller_api; SET LOCAL app.seller_id = '${sa}'`)
      const seenA = await tx.unsafe(`SELECT id FROM offers ORDER BY id`)
      expect(seenA.map((r) => (r as unknown as { id: string }).id)).toEqual([oa])
      const updated = await tx.unsafe(`UPDATE offers SET on_hand = 9 WHERE id = '${ob}'`)
      expect(updated.count).toBe(0)
      await expect(
        tx.unsafe(
          `INSERT INTO offers (id, seller_id, product_id, variant_id, price_pesewas, on_hand) VALUES ('rls-evil-${suffix}', '${sb}', '${prod}', '${vb}', 1, 1)`,
        ),
      ).rejects.toThrow()

      // Flip the fence: B sees only B.
      await tx.unsafe(`SET LOCAL app.seller_id = '${sb}'`)
      const seenB = await tx.unsafe(`SELECT id FROM offers ORDER BY id`)
      expect(seenB.map((r) => (r as unknown as { id: string }).id)).toEqual([ob])

      // Owner connection (no role set): sees everything — platform paths intact.
      await tx.unsafe(`RESET ROLE`)
      const seenOwner = await tx.unsafe(`SELECT id FROM offers ORDER BY id`)
      expect(seenOwner.map((r) => (r as unknown as { id: string }).id)).toEqual([oa, ob])
    })
  }, 120_000)
})
