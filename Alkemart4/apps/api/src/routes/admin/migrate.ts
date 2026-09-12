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
import { runPaymentIntentExpiry } from "../../payment-intent-expiry"
import { runNotificationDispatch } from "../../notifications-dispatch"

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
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS description text`)
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS logo text`)
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS banner text`)
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS metadata jsonb`)
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS admin_actions (id text PRIMARY KEY, admin_user_id text NOT NULL REFERENCES users(id), action text NOT NULL, target_type text NOT NULL, target_id text NOT NULL, detail jsonb, created_at timestamptz NOT NULL DEFAULT now())`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS shop_views (seller_id text NOT NULL REFERENCES sellers(id), product_id text REFERENCES products(id), day date NOT NULL, views integer NOT NULL DEFAULT 0)`)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS shop_views_product_day_uidx ON shop_views (seller_id, product_id, day)`)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS shop_views_shop_day_uidx ON shop_views (seller_id, day) WHERE product_id IS NULL`)
    await db.execute(sql`DO $$ BEGIN CREATE TYPE appeal_status AS ENUM('open', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await db.execute(sql`DO $$ BEGIN CREATE TYPE appeal_decision AS ENUM('reopened', 'upheld'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS moderation_appeals (id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id), seller_id text NOT NULL REFERENCES sellers(id), message text NOT NULL, status appeal_status NOT NULL DEFAULT 'open', decision appeal_decision, response text, created_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz)`)
    await db.execute(sql`DO $$ BEGIN CREATE TYPE seller_availability AS ENUM('open', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS availability seller_availability NOT NULL DEFAULT 'open'`)
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS paused_until timestamptz`)
    await db.execute(sql`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS pause_note text`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS shop_policy_versions (id text PRIMARY KEY, seller_id text NOT NULL REFERENCES sellers(id), version integer NOT NULL, body jsonb NOT NULL, effective_from timestamptz NOT NULL DEFAULT now())`)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS shop_policy_versions_seller_version_uidx ON shop_policy_versions (seller_id, version)`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS shop_featured (seller_id text NOT NULL REFERENCES sellers(id), product_id text NOT NULL REFERENCES products(id), rank integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS shop_featured_seller_product_uidx ON shop_featured (seller_id, product_id)`)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS shop_featured_seller_rank_uidx ON shop_featured (seller_id, rank)`)
    await db.execute(sql`DO $$ BEGIN CREATE TYPE notification_status AS ENUM('pending', 'sent', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS notifications (id text PRIMARY KEY, key text NOT NULL UNIQUE, channel text NOT NULL DEFAULT 'sms', recipient text NOT NULL, body text NOT NULL, status notification_status NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, last_error text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz)`)
    await db.execute(sql`DO $$ BEGIN CREATE TYPE review_status AS ENUM('pending', 'published', 'hidden'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS reviews (id text PRIMARY KEY, order_id text NOT NULL UNIQUE REFERENCES orders(id), product_id text NOT NULL REFERENCES products(id), seller_id text NOT NULL REFERENCES sellers(id), buyer_email text NOT NULL, rating integer NOT NULL, title text, body text NOT NULL, status review_status NOT NULL DEFAULT 'pending', vendor_response text, responded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS product_options (id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id), name text NOT NULL, position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS product_option_values (id text PRIMARY KEY, option_id text NOT NULL REFERENCES product_options(id), value text NOT NULL, position integer NOT NULL DEFAULT 0)`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS variant_option_values (id text PRIMARY KEY, variant_id text NOT NULL REFERENCES product_variants(id), value_id text NOT NULL REFERENCES product_option_values(id))`)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS variant_option_values_variant_value_uidx ON variant_option_values (variant_id, value_id)`)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS product_option_values_option_value_uidx ON product_option_values (option_id, value)`)
    await db.execute(sql`ALTER TABLE product_option_values ADD COLUMN IF NOT EXISTS image_url text`)
    await db.execute(sql`CREATE TABLE IF NOT EXISTS content_pages (key text PRIMARY KEY, revision integer NOT NULL DEFAULT 1, draft_sections jsonb NOT NULL DEFAULT '[]'::jsonb, published_sections jsonb NOT NULL DEFAULT '[]'::jsonb, scheduled_sections jsonb, publish_at timestamptz, unpublish_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now())`)
    await db.execute(sql`ALTER TABLE product_option_values ADD COLUMN IF NOT EXISTS image_url text`)
    return c.json({
      ok: true,
      applied: [
        "payment_intents.shipping_address",
        "products.image_url",
        "products.created_at",
        "sellers.description",
        "sellers.logo",
        "sellers.banner",
        "sellers.metadata",
        "sellers.created_at",
        "admin_actions",
        "shop_views",
        "moderation_appeals",
        "sellers.availability",
        "sellers.paused_until",
        "sellers.pause_note",
        "shop_policy_versions",
        "shop_featured",
        "notifications",
        "reviews",
        "product_options",
        "product_option_values.image_url",
        "content_pages",
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
  /**
   * Free-tier workaround when Workers cron slots are exhausted (API 10072).
   * Same job as the hourly `[triggers]` cron — call from an external scheduler
   * with an admin JWT until Workers Paid or a cron slot is freed.
   */
  .post("/expire-payment-intents", async (c) => {
    const expired = await runPaymentIntentExpiry(null, c.env, null)
    return c.json({ ok: true, expired })
  })
  /**
   * Same job as the cron sender — external scheduler with an admin JWT
   * when Workers cron slots are exhausted. Sends due fulfillment SMS.
   */
  .post("/send-notifications", async (c) => {
    const result = await runNotificationDispatch(null, c.env, null)
    return c.json({ ok: true, ...result })
  })
