import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const legacyFields = [
  "id", "title", "subtitle", "description", "handle",
  "is_giftcard", "discountable", "thumbnail",
  "collection_id", "type_id",
  "weight", "length", "height", "width",
  "hs_code", "origin_country", "mid_code", "material",
  "created_at", "updated_at",
  "*type", "*collection", "*options", "*options.values",
  "*tags", "*images", "*variants", "*variants.options",
]

const mikroFields = [
  "id", "title", "subtitle", "description", "handle",
  "is_giftcard", "discountable", "thumbnail",
  "collection_id", "type_id",
  "weight", "length", "height", "width",
  "hs_code", "origin_country", "mid_code", "material",
  "created_at", "updated_at",
  "type.*", "collection.*", "options.*", "options.values.*",
  "tags.*", "images.*", "variants.*", "variants.options.*",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Test 1: legacy *prefix format
    const { data: t1 } = await query.graph({
      entity: "product",
      fields: legacyFields,
      filters: { status: "published" },
      pagination: { skip: 0, take: 50 },
    }, { cache: { enable: true } })

    // Test 2: mikro .*suffix format
    const { data: t2 } = await query.graph({
      entity: "product",
      fields: mikroFields,
      filters: { status: "published" },
      pagination: { skip: 0, take: 50 },
    }, { cache: { enable: true } })

    // Test 3: legacy format, no status filter
    const { data: t3 } = await query.graph({
      entity: "product",
      fields: legacyFields,
      pagination: { skip: 0, take: 50 },
    }, { cache: { enable: true } })

    // Test 4: mikro format, no status filter
    const { data: t4 } = await query.graph({
      entity: "product",
      fields: mikroFields,
      pagination: { skip: 0, take: 50 },
    }, { cache: { enable: true } })

    // Raw count from Neon
    const { Client } = require("pg")
    const neon = new Client("postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require")
    await neon.connect()
    const { rows: totalProducts } = await neon.query("SELECT COUNT(*) FROM product WHERE deleted_at IS NULL")
    const { rows: publishedProducts } = await neon.query("SELECT COUNT(*) FROM product WHERE deleted_at IS NULL AND status = 'published'")
    await neon.end()

    // Check store default region
    const { data: stores } = await query.graph({ entity: "store", fields: ["id", "name", "default_region_id"] })

    res.json({
      raw_db: {
        total: parseInt(totalProducts[0].count),
        published: parseInt(publishedProducts[0].count),
      },
      tests: {
        legacy_published: { count: t1.length, ids: t1.map((p: any) => p.id) },
        mikro_published: { count: t2.length, ids: t2.map((p: any) => p.id) },
        legacy_all: { count: t3.length },
        mikro_all: { count: t4.length },
      },
      stores: stores.map((s: any) => ({ id: s.id, name: s.name, default_region_id: s.default_region_id })),
    })
  } catch (e: any) {
    res.status(500).json({
      error: e.message,
      stack: e.stack?.slice(0, 1000),
    })
  }
}
