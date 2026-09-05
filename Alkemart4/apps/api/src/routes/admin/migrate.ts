import { sql } from "drizzle-orm"
import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { primaryDb } from "../../db"
import { parseEnv } from "../../env"
import { requireAdmin } from "../../middleware/auth"

/** One-shot schema patches applied via Hyperdrive (local machine may lack DB reachability). */
export const adminMigrate = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .post("/shipping-address", async (c) => {
    const env = parseEnv(c.env as unknown as Record<string, unknown>)
    const db = primaryDb(env)
    await db.execute(sql`ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS shipping_address jsonb`)
    return c.json({ ok: true, applied: "payment_intents.shipping_address" })
  })
  /**
   * Point demo vendor@alkemart.test at catalog seller-a so vendor SPA sees
   * Tecno Spark stock/orders without rewriting storefront offers.
   */
  /** Apply known schema patches (idempotent). Prefer drizzle migrate in CI when DB is reachable. */
  .post("/schema", async (c) => {
    const env = parseEnv(c.env as unknown as Record<string, unknown>)
    const db = primaryDb(env)
    await db.execute(sql`ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS shipping_address jsonb`)
    return c.json({
      ok: true,
      applied: ["payment_intents.shipping_address"],
      note: "Use packages/db drizzle migrate when direct DATABASE_URL is available",
    })
  })
  .post("/link-demo-vendor-to-seller-a", async (c) => {
    const env = parseEnv(c.env as unknown as Record<string, unknown>)
    const db = primaryDb(env)
    await db.execute(sql`
      DELETE FROM seller_members
      WHERE user_id = (SELECT id FROM users WHERE email = 'vendor@alkemart.test')
        AND seller_id <> 'seller-a'
    `)
    await db.execute(sql`
      INSERT INTO seller_members (user_id, seller_id, role)
      SELECT id, 'seller-a', 'owner'
      FROM users
      WHERE email = 'vendor@alkemart.test'
      ON CONFLICT (user_id, seller_id) DO UPDATE SET role = EXCLUDED.role
    `)
    await db.execute(sql`
      UPDATE sellers SET status = 'open' WHERE id = 'seller-a'
    `)
    return c.json({
      ok: true,
      applied: "seller_members: vendor@alkemart.test → seller-a",
    })
  })
