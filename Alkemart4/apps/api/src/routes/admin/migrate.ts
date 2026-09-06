import { users } from "@alkemart/db"
import { hashPassword } from "@alkemart/domain"
import { eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { primaryDb } from "../../db"
import { parseEnv } from "../../env"
import { requireAdmin } from "../../middleware/auth"

const RotateDemoPasswordsSchema = z.object({
  adminPassword: z.string().min(10).optional(),
  vendorPassword: z.string().min(10).optional(),
  buyerPassword: z.string().min(10).optional(),
})

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
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text`)
    await db.execute(
      sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`,
    )
    return c.json({
      ok: true,
      applied: [
        "payment_intents.shipping_address",
        "products.image_url",
        "products.created_at",
      ],
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
  /**
   * Rotate lab demo account passwords. Does not invent passwords —
   * caller must supply new values. Update docs/DEMO-ACCOUNTS.md after.
   */
  .post("/rotate-demo-passwords", async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = RotateDemoPasswordsSchema.safeParse(body)
    if (!parsed.success) {
      throw new HTTPException(400, { message: "Invalid body" })
    }
    const updates: Array<{ email: string; password: string }> = []
    if (parsed.data.adminPassword) {
      updates.push({ email: "admin@alkemart.test", password: parsed.data.adminPassword })
    }
    if (parsed.data.vendorPassword) {
      updates.push({ email: "vendor@alkemart.test", password: parsed.data.vendorPassword })
    }
    if (parsed.data.buyerPassword) {
      updates.push({ email: "buyer@alkemart.test", password: parsed.data.buyerPassword })
    }
    if (updates.length === 0) {
      throw new HTTPException(400, {
        message: "Provide at least one of adminPassword, vendorPassword, buyerPassword (min 10 chars)",
      })
    }

    const env = parseEnv(c.env as unknown as Record<string, unknown>)
    const db = primaryDb(env)
    const applied: string[] = []
    for (const u of updates) {
      const passwordHash = await hashPassword(u.password)
      const result = await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.email, u.email))
        .returning({ email: users.email })
      if (result[0]) applied.push(result[0].email)
    }
    return c.json({
      ok: true,
      applied,
      note: "Update docs/DEMO-ACCOUNTS.md and any CI secrets. Old sessions remain until JWT expiry.",
    })
  })
