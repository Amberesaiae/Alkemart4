import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway"

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

    const { rows: statusRows } = await dst.query(`SELECT status, COUNT(*) as cnt FROM product GROUP BY status`)
    const { rows: deletedCheck } = await dst.query(`SELECT COUNT(*) as cnt FROM product WHERE deleted_at IS NOT NULL`)
    const { rows: totalRows } = await dst.query(`SELECT COUNT(*) as cnt FROM product`)
    const { rows: salesChanRows } = await dst.query(`SELECT id, name FROM sales_channel`)

    const { rows: publishedCount } = await dst.query(`SELECT COUNT(*) as cnt FROM product WHERE status = 'published'`)
    await dst.end()

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: any) => Promise<{ data: any[] }>
    }

    // 1. Query products via Medusa Query API
    const qProducts = await query.graph({ entity: "product", fields: ["id", "title", "status"] })
    const qCount = qProducts.data.length

    // 2. Query sales channels via Medusa Query API
    const qSC = await query.graph({ entity: "sales_channel", fields: ["id", "name", "description"] })
    const qSCs = qSC.data

    // 3. Check API key → sales channel links
    const qKeyChan = await query.graph({
      entity: "publishable_api_key_sales_channel",
      fields: ["publishable_api_key_id", "sales_channel_id"],
    })
    const keyChanLinks = qKeyChan.data

    // 4. Check product → sales channel links
    const qProdChan = await query.graph({
      entity: "product_sales_channel",
      fields: ["product_id", "sales_channel_id"],
    })
    const prodChanLinks = qProdChan.data

    res.json({
      total_products: parseInt(totalRows[0].cnt),
      published: parseInt(publishedCount[0].cnt),
      statuses: statusRows,
      deleted_remaining: parseInt(deletedCheck[0].cnt),
      query_api_product_count: qCount,
      query_api_products: qProducts.data.map((p: any) => ({ id: p.id, title: p.title, status: p.status })),
      sales_channels: qSCs,
      raw_sales_channels: salesChanRows,
      publishable_api_key_links: keyChanLinks,
      product_sales_channel_links: prodChanLinks.slice(0, 15),
      product_sales_channel_count: prodChanLinks.length,
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message })
  }
}
