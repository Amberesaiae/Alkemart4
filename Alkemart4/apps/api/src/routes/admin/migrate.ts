import { attributeDefinitions, attributeProfiles, profileAttributes, users } from "@alkemart/db"
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
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes jsonb`)
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
        "products.attributes",
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
  /**
   * Blueprint Phase 1 foundations (taxonomy lifecycle, identity confidence,
   * typed attributes, match candidates, collections, offer terms).
   * Idempotent — mirrors packages/db/src/migrations/0020_blueprint_phase1.sql.
   */
  .post("/blueprint-phase1", async (c) => {
    const env = parseEnv(c.env as unknown as Record<string, unknown>)
    const db = primaryDb(env)
    const applied: string[] = []
    const exec = async (label: string, statement: ReturnType<typeof sql>) => {
      await db.execute(statement)
      applied.push(label)
    }
    await exec("taxonomy_status", sql`DO $$ BEGIN CREATE TYPE taxonomy_status AS ENUM('proposed', 'active', 'deprecated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await exec("identity_confidence", sql`DO $$ BEGIN CREATE TYPE identity_confidence AS ENUM('identified', 'matched', 'seller_specific'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await exec("attribute_type", sql`DO $$ BEGIN CREATE TYPE attribute_type AS ENUM('text', 'number', 'boolean', 'option', 'multi_option'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await exec("match_candidate_status", sql`DO $$ BEGIN CREATE TYPE match_candidate_status AS ENUM('proposed', 'confirmed', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await exec("collection_visibility", sql`DO $$ BEGIN CREATE TYPE collection_visibility AS ENUM('draft', 'published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
    await exec("categories.code", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS code text`)
    await exec("categories.display_name", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_name text`)
    await exec("categories.slug", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug text`)
    await exec("categories.level", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 0`)
    await exec("categories.status", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS status taxonomy_status NOT NULL DEFAULT 'active'`)
    await exec("categories.is_browseable", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_browseable boolean NOT NULL DEFAULT true`)
    await exec("categories.is_assignable", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_assignable boolean NOT NULL DEFAULT true`)
    await exec("categories.is_nav_visible", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_nav_visible boolean NOT NULL DEFAULT true`)
    await exec("categories.attribute_profile_id", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS attribute_profile_id text`)
    await exec("categories.replacement_node_id", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS replacement_node_id text REFERENCES categories(id)`)
    await exec("categories.sort_order", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`)
    await exec("categories.version", sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1`)
    await exec("products.brand", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand text`)
    await exec("products.model", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS model text`)
    await exec("products.gtin", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin text`)
    await exec("products.mpn", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS mpn text`)
    await exec("products.manufacturer", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer text`)
    await exec("products.product_type", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type text`)
    await exec("products.identity_confidence", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS identity_confidence identity_confidence NOT NULL DEFAULT 'seller_specific'`)
    await exec("products.identity_provenance", sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS identity_provenance jsonb`)
    await exec("product_variants.image_url", sql`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url text`)
    await exec("product_variants.weight_grams", sql`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS weight_grams integer`)
    await exec("product_variants.gtin", sql`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS gtin text`)
    await exec("offers.condition", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS condition text`)
    await exec("offers.compare_at_pesewas", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS compare_at_pesewas bigint`)
    await exec("offers.compare_at_provenance", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS compare_at_provenance text`)
    await exec("offers.fulfillment_origin", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS fulfillment_origin text`)
    await exec("offers.warranty_ref", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS warranty_ref text`)
    await exec("offers.returns_ref", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS returns_ref text`)
    await exec("offers.delivery_promise", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS delivery_promise text`)
    await exec("offers.freshness_at", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS freshness_at timestamptz`)
    await exec("offers.published_at", sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS published_at timestamptz`)
    await exec("attribute_definitions", sql`CREATE TABLE IF NOT EXISTS attribute_definitions (id text PRIMARY KEY, code text NOT NULL UNIQUE, label text NOT NULL, type attribute_type NOT NULL, unit_family text, allowed_values jsonb, filterable boolean NOT NULL DEFAULT false, searchable boolean NOT NULL DEFAULT false, required boolean NOT NULL DEFAULT false, variant_axis boolean NOT NULL DEFAULT false, visible_on_card boolean NOT NULL DEFAULT false, visible_on_pdp boolean NOT NULL DEFAULT true)`)
    await exec("attribute_profiles", sql`CREATE TABLE IF NOT EXISTS attribute_profiles (id text PRIMARY KEY, name text NOT NULL, category_id text, version integer NOT NULL DEFAULT 1)`)
    await exec("profile_attributes", sql`CREATE TABLE IF NOT EXISTS profile_attributes (id text PRIMARY KEY, profile_id text NOT NULL REFERENCES attribute_profiles(id), definition_id text NOT NULL REFERENCES attribute_definitions(id), position integer NOT NULL DEFAULT 0, required boolean NOT NULL DEFAULT false, UNIQUE (profile_id, definition_id))`)
    await exec("product_attribute_values", sql`CREATE TABLE IF NOT EXISTS product_attribute_values (id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id), definition_id text NOT NULL REFERENCES attribute_definitions(id), text_value text, number_value double precision, boolean_value boolean, option_values jsonb, unit text, UNIQUE (product_id, definition_id))`)
    await exec("product_match_candidates", sql`CREATE TABLE IF NOT EXISTS product_match_candidates (id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id), candidate_product_id text NOT NULL REFERENCES products(id), source text NOT NULL, evidence jsonb, status match_candidate_status NOT NULL DEFAULT 'proposed', reviewer_id text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`)
    await exec("collections", sql`CREATE TABLE IF NOT EXISTS collections (id text PRIMARY KEY, seller_id text NOT NULL REFERENCES sellers(id), name text NOT NULL, slug text NOT NULL, description text, image_url text, visibility collection_visibility NOT NULL DEFAULT 'draft', position integer NOT NULL DEFAULT 0, starts_at timestamptz, ends_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`)
    await exec("collection_products", sql`CREATE TABLE IF NOT EXISTS collection_products (id text PRIMARY KEY, collection_id text NOT NULL REFERENCES collections(id), product_id text NOT NULL REFERENCES products(id), position integer NOT NULL DEFAULT 0, UNIQUE (collection_id, product_id))`)
    return c.json({ ok: true, applied })
  })
  /**
   * Blueprint Phase 1C — seed the governed Phones attribute profile.
   * Idempotent: existing codes/profiles are reused, never duplicated.
   * Category linkage stays null until taxonomy assignment (Phase 1A UI).
   */
  .post("/phones-profile", async (c) => {
    const env = parseEnv(c.env as unknown as Record<string, unknown>)
    const db = primaryDb(env)
    const defs: Array<{
      code: string
      label: string
      type: "text" | "number" | "boolean" | "option" | "multi_option"
      unitFamily?: string
      allowedValues?: string[]
      filterable: boolean
      searchable: boolean
      required: boolean
      variantAxis: boolean
      visibleOnCard: boolean
      visibleOnPdp: boolean
    }> = [
      { code: "phone.brand", label: "Brand", type: "text", filterable: true, searchable: true, required: true, variantAxis: false, visibleOnCard: true, visibleOnPdp: true },
      { code: "phone.model_family", label: "Model family", type: "text", filterable: true, searchable: true, required: false, variantAxis: false, visibleOnCard: false, visibleOnPdp: true },
      { code: "phone.storage_gb", label: "Storage", type: "number", unitFamily: "storage", filterable: true, searchable: false, required: false, variantAxis: true, visibleOnCard: false, visibleOnPdp: true },
      { code: "phone.ram_gb", label: "RAM", type: "number", unitFamily: "memory", filterable: true, searchable: false, required: false, variantAxis: true, visibleOnCard: false, visibleOnPdp: true },
      { code: "phone.network", label: "Network", type: "option", allowedValues: ["4G", "5G"], filterable: true, searchable: false, required: false, variantAxis: true, visibleOnCard: false, visibleOnPdp: true },
      { code: "phone.condition", label: "Condition", type: "option", allowedValues: ["new", "locally_used", "refurbished"], filterable: true, searchable: false, required: true, variantAxis: false, visibleOnCard: true, visibleOnPdp: true },
    ]
    const existing = await db.select({ code: attributeDefinitions.code }).from(attributeDefinitions)
    const have = new Set(existing.map((r) => r.code.toLowerCase()))
    for (const d of defs) {
      if (have.has(d.code.toLowerCase())) continue
      await db.insert(attributeDefinitions).values({
        id: crypto.randomUUID(),
        code: d.code,
        label: d.label,
        type: d.type,
        unitFamily: d.unitFamily ?? null,
        allowedValues: d.allowedValues ?? null,
        filterable: d.filterable,
        searchable: d.searchable,
        required: d.required,
        variantAxis: d.variantAxis,
        visibleOnCard: d.visibleOnCard,
        visibleOnPdp: d.visibleOnPdp,
      })
    }
    const profiles = await db
      .select({ id: attributeProfiles.id })
      .from(attributeProfiles)
      .where(eq(attributeProfiles.name, "phones-v1"))
    let profileId = profiles[0]?.id ?? null
    if (!profileId) {
      profileId = crypto.randomUUID()
      await db.insert(attributeProfiles).values({ id: profileId, name: "phones-v1", categoryId: null, version: 1 })
    }
    const rows = await db.select().from(attributeDefinitions)
    const byCode = new Map(rows.map((r) => [r.code.toLowerCase(), r.id]))
    let position = 0
    for (const d of defs) {
      const definitionId = byCode.get(d.code.toLowerCase())
      if (!definitionId) continue
      await db
        .insert(profileAttributes)
        .values({ id: crypto.randomUUID(), profileId, definitionId, position: position++, required: d.required })
        .onConflictDoNothing()
    }
    return c.json({ ok: true, profile: "phones-v1", definitions: defs.map((d) => d.code) })
  })
