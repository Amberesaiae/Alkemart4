import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { Client } = require("pg")
    const dst = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await dst.connect()

    await dst.query(`UPDATE product SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE product_variant SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE product_option SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE product_option_value SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE image SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)

    await dst.end()

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: any) => Promise<{ data: any[]; metadata?: any }>
    }

    const results: Record<string, any> = {}

    // Test A: query.graph with minimal fields, status filter
    try {
      const a = await query.graph({
        entity: "product",
        fields: ["id", "title", "status"],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
      })
      results.testA_minimal = { count: a.data.length }
    } catch (e: any) {
      results.testA_minimal = { error: e.message }
    }

    // Test B: query.graph with store product fields
    // These are the fields used by the store product endpoint
    try {
      const b = await query.graph({
        entity: "product",
        fields: [
          "id", "title", "subtitle", "description", "handle", "is_giftcard",
          "status", "thumbnail", "weight", "length", "height", "width",
          "origin_country", "hs_code", "mid_code", "material", "collection_id",
          "type_id", "discountable", "external_id", "created_at", "updated_at",
          "images.*", "options.*", "options.values.*",
          "variants.*", "variants.options.*",
          "tags.*", "type.*", "collection.*", "categories.*",
        ],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
      })
      results.testB_full_fields = { count: b.data.length, metadata: b.metadata }
    } catch (e: any) {
      results.testB_full_fields = { error: e.message?.slice(0, 300) }
    }

    // Test C: query.graph with pricing context
    try {
      const c = await query.graph({
        entity: "product",
        fields: ["id", "title", "status"],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
        context: { variants: { calculated_price: {} } },
      })
      results.testC_with_pricing = { count: c.data.length }
    } catch (e: any) {
      results.testC_with_pricing = { error: e.message?.slice(0, 300) }
    }

    // Test D: query.graph with NO cache
    try {
      const d = await query.graph({
        entity: "product",
        fields: ["id", "title", "status"],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
      }, { cache: { enable: false } })
      results.testD_no_cache = { count: d.data.length }
    } catch (e: any) {
      results.testD_no_cache = { error: e.message }
    }

    res.json(results)
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message, stack: (e as Error).stack?.slice(0, 500) })
  }
}
