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

    // Test 1: basic query all products
    const t1 = await query.graph({ entity: "product", fields: ["id", "title", "status"] })

    // Test 2: query with status filter
    const t2 = await query.graph({
      entity: "product",
      fields: ["id", "title", "status"],
      filters: { status: ["published"] },
    })

    // Test 3: query with status + sales_channel_id filter
    const t3 = await query.graph({
      entity: "product",
      fields: ["id", "title", "status"],
      filters: { status: ["published"], sales_channel_id: "sc_01KXMN56SN3RSCSP55KE3A8BD4" },
    })

    // Test 4: query product_sales_channel directly
    const t4 = await query.graph({
      entity: "product_sales_channel",
      fields: ["product_id", "sales_channel_id"],
      filters: { sales_channel_id: "sc_01KXMN56SN3RSCSP55KE3A8BD4" },
    })

    // Test 5: query the store-facing product entity with full config
    const { rows: scProducts } = await dst.query(`
      SELECT p.id, p.title, p.status FROM product p
      INNER JOIN product_sales_channel psc ON p.id = psc.product_id
      WHERE psc.sales_channel_id = 'sc_01KXMN56SN3RSCSP55KE3A8BD4'
        AND p.status = 'published'
    `)

    res.json({
      test1_all: { count: t1.data.length, products: t1.data.slice(0, 3) },
      test2_status_published: { count: t2.data.length },
      test3_status_and_sc: { count: t3.data.length },
      test4_product_sc: { count: t4.data.length, links: t4.data.slice(0, 3) },
      test5_raw_sql_sc_published: scProducts.length,
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message, stack: (e as Error).stack })
  }
}
