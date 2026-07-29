import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const defaultFields = [
  "id", "title", "subtitle", "description", "handle",
  "is_giftcard", "discountable", "thumbnail",
  "collection_id", "type_id",
  "weight", "length", "height", "width",
  "hs_code", "origin_country", "mid_code", "material",
  "created_at", "updated_at",
  "*type", "*collection", "*options", "*options.values",
  "*tags", "*images", "*variants", "*variants.options",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const step0 = { filterableFields: {}, pricingContext: null }

    // Step 1: Just status filter
    const { data: step1 } = await query.graph({
      entity: "product",
      fields: ["id", "title", "status"],
      filters: { status: "published" },
      pagination: { skip: 0, take: 50 },
    }, { cache: { enable: true } })

    // Step 2: With all default fields (no status filter)
    const { data: step2 } = await query.graph({
      entity: "product",
      fields: defaultFields,
      pagination: { skip: 0, take: 50 },
    }, { cache: { enable: true } })

    // Step 3: Full simulation - status published + all fields
    const { data: step3 } = await query.graph({
      entity: "product",
      fields: defaultFields,
      filters: { status: "published" },
      pagination: { skip: 0, take: 50 },
    }, { cache: { enable: true } })

    // Step 4: Raw count from Neon
    const { Client } = require("pg")
    const neon = new Client("postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require")
    await neon.connect()
    const { rows: totalProducts } = await neon.query("SELECT COUNT(*) FROM product WHERE deleted_at IS NULL")
    const { rows: publishedProducts } = await neon.query("SELECT COUNT(*) FROM product WHERE deleted_at IS NULL AND status = 'published'")
    await neon.end()

    // Step 5: Check region
    const { data: regions } = await query.graph({ entity: "region", fields: ["id", "name", "currency_code"] })

    // Step 6: Check store
    const { data: stores } = await query.graph({ entity: "store", fields: ["id", "name", "default_region_id"] })

    res.json({
      raw_db: {
        total_products: parseInt(totalProducts[0].count),
        published_products: parseInt(publishedProducts[0].count),
      },
      query: {
        step1_status_only: { count: step1.length, ids: step1.map((p: any) => p.id) },
        step2_all_fields_no_filter: { count: step2.length, ids: step2.map((p: any) => p.id) },
        step3_published_all_fields: { count: step3.length, ids: step3.map((p: any) => p.id) },
      },
      regions: regions.map((r: any) => ({ id: r.id, name: r.name, currency_code: r.currency_code })),
      stores: stores.map((s: any) => ({ id: s.id, name: s.name, default_region_id: s.default_region_id })),
      fields_used: defaultFields,
    })
  } catch (e: any) {
    res.status(500).json({
      error: e.message,
      stack: e.stack?.slice(0, 1000),
    })
  }
}
