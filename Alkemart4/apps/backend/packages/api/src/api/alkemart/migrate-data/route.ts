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
      graph: (args: any, opts?: any) => Promise<{ data: any[]; metadata?: any }>
    }

    // Exact store product fields from query-config.js
    const fields = [
      "id", "title", "subtitle", "description", "handle", "is_giftcard",
      "discountable", "thumbnail", "collection_id", "type_id",
      "weight", "length", "height", "width", "hs_code", "origin_country",
      "mid_code", "material", "created_at", "updated_at",
      "*type", "*collection", "*options", "*options.values",
      "*tags", "*images", "*variants", "*variants.options",
    ]

    // Same query the store endpoint makes
    const { data: products, metadata } = await query.graph({
      entity: "product",
      fields,
      filters: { status: ["published"] as any },
      pagination: { skip: 0, take: 50 },
      context: {},
    }, {
      cache: { enable: true },
    })

    res.json({
      count: products.length,
      metadata,
      first_three: products.slice(0, 3).map((p: any) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        has_variants: Array.isArray(p.variants) ? p.variants.length : 0,
      })),
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message, stack: (e as Error).stack?.slice(0, 500) })
  }
}
