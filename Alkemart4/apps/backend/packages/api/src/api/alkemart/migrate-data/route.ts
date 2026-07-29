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

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: any, opts?: any) => Promise<{ data: any[]; metadata?: any }>
    }

    const results: Record<string, any> = {}

    // 1. Why are product_variants not joining? Check FK
    const { rows: fkCheck } = await dst.query(`
      SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
             ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'product_variant'
    `)

    // 2. Check all variants and their product_id
    const { rows: variants } = await dst.query(`SELECT id, product_id, title FROM product_variant ORDER BY id`)
    const { rows: products } = await dst.query(`SELECT id, title FROM product ORDER BY id`)

    // 3. Re-insert product_variant rows with proper MikroORM-managed IDs if needed
    //    For now just check the join directly with raw SQL
    const { rows: joinTest } = await dst.query(`
      SELECT p.id, p.title, COUNT(pv.id) as variant_count
      FROM product p
      LEFT JOIN product_variant pv ON p.id = pv.product_id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.title
      ORDER BY p.id
    `)

    await dst.end()

    results.fk_constraints = fkCheck
    results.variant_count_raw = variants.length
    results.product_count_raw = products.length
    results.join_test = joinTest.map((r: any) => ({
      product_id: r.id,
      title: r.title,
      variant_count: parseInt(r.variant_count),
    }))

    // 4. Now test query.graph with *variants, but also request specific variant fields
    try {
      const r = await query.graph({
        entity: "product",
        fields: ["id", "title", "variants.id", "variants.title", "variants.sku"],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
      })
      results.query_by_variant_fields = {
        count: r.data.length,
        products_with_variants: r.data.filter((p: any) => Array.isArray(p.variants) && p.variants.length > 0).length,
        sample: r.data.slice(0, 2).map((p: any) => ({
          id: p.id,
          title: p.title,
          variant_ids: Array.isArray(p.variants) ? p.variants.map((v: any) => v.id) : [],
        })),
      }
    } catch (e: any) {
      results.query_by_variant_fields = { error: e.message.slice(0, 300) }
    }

    // 5. Test store endpoint behavior by triggering the error path
    try {
      const r = await query.graph({
        entity: "product",
        fields: [
          "id", "title", "subtitle", "description", "handle", "is_giftcard",
          "discountable", "thumbnail", "collection_id", "type_id",
          "weight", "length", "height", "width", "hs_code", "origin_country",
          "mid_code", "material", "created_at", "updated_at",
          "*type", "*collection", "*options", "*options.values",
          "*tags", "*images", "*variants", "*variants.options",
          "variants.calculated_price",
        ],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
      })
      results.test_store_query = { count: r.data.length }
    } catch (e: any) {
      results.test_store_query = { error: e.message.slice(0, 300) }
    }

    res.json(results)
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message, stack: (e as Error).stack?.slice(0, 500) })
  }
}
