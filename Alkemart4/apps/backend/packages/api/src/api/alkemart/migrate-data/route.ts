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

    // Test 1: basic query all products
    try {
      const t1 = await query.graph({ entity: "product", fields: ["id", "title", "status"] })
      results.test1_all = { count: t1.data.length }
    } catch (e: any) {
      results.test1_all = { error: e.message }
    }

    // Test 2: status filter
    try {
      const t2 = await query.graph({
        entity: "product",
        fields: ["id", "title", "status"],
        filters: { status: ["published"] as any },
      })
      results.test2_status = { count: t2.data.length }
    } catch (e: any) {
      results.test2_status = { error: e.message }
    }

    // Test 3: query product_sales_channel links directly
    try {
      const t4 = await query.graph({
        entity: "product_sales_channel",
        fields: ["product_id", "sales_channel_id"],
        filters: { sales_channel_id: "sc_01KXMN56SN3RSCSP55KE3A8BD4" },
      })
      results.test3_product_sc = { count: t4.data.length }
    } catch (e: any) {
      results.test3_product_sc = { error: e.message }
    }

    res.json(results)
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message, stack: (e as Error).stack?.slice(0, 500) })
  }
}
