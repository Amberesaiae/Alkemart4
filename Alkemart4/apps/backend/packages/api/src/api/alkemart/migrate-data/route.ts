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

    const results: Record<string, any> = {}

    // Test 1: query with *variants (no context)
    try {
      const r = await query.graph({
        entity: "product",
        fields: ["id", "title", "*variants"],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
        context: {},
      }, { cache: { enable: true } })
      results.test1_no_context = {
        count: r.data.length,
        with_variants: r.data.filter((p: any) => Array.isArray(p.variants) && p.variants.length > 0).length,
      }
    } catch (e: any) {
      results.test1_no_context = { error: e.message.slice(0, 300) }
    }

    // Test 2: query with calculated_price context
    try {
      const r = await query.graph({
        entity: "product",
        fields: ["id", "title", "*variants", "variants.calculated_price"],
        filters: { status: ["published"] as any },
        pagination: { skip: 0, take: 50 },
        context: { variants: { calculated_price: { region_id: "reg_01KXMN5BATYHZ939TA7AN9R52T", currency_code: "ghs" } } },
      }, { cache: { enable: true } })
      results.test2_with_calculated_price = {
        count: r.data.length,
        with_price: r.data.filter((p: any) =>
          Array.isArray(p.variants) && p.variants.some((v: any) => v.calculated_price)
        ).length,
      }
    } catch (e: any) {
      results.test2_with_calculated_price = { error: e.message.slice(0, 300) }
    }

    // Test 3: variant count directly
    try {
      const r = await query.graph({
        entity: "product_variant",
        fields: ["id", "product_id", "title", "sku"],
        pagination: { skip: 0, take: 100 },
      })
      results.test3_variants = {
        count: r.data.length,
        sample: r.data.slice(0, 3),
      }
    } catch (e: any) {
      results.test3_variants = { error: e.message.slice(0, 300) }
    }

    res.json(results)
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message, stack: (e as Error).stack?.slice(0, 500) })
  }
}
