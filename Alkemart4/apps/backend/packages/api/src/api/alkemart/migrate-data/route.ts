import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

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

    // Investigate store product pipeline
    // 1. What publishable API keys exist?
    const { rows: apiKeys } = await dst.query(`SELECT * FROM publishable_api_key`)
    // 2. What sales channels are linked to which API key?
    const { rows: scLinks } = await dst.query(`SELECT * FROM "publishable_api_key_sales_channel"`)
    // 3. Check if product_sales_channel raw links exist
    const { rows: pscRaw } = await dst.query(`SELECT * FROM "product_sales_channel"`)
    // 4. Check product statuses
    const { rows: pRows } = await dst.query(`SELECT id, title, status FROM product ORDER BY created_at`)
    // 5. Try deleting and re-creating API key→SC link via raw SQL
    const apiKeyId = apiKeys.length > 0 ? apiKeys[0].id : null

    await dst.end()

    res.json({
      api_keys: apiKeys.map((k: any) => ({ id: k.id, title: k.title })),
      api_key_sales_channel_links: scLinks,
      product_sales_channel_count: pscRaw.length,
      first_product: pRows.length > 0 ? pRows[0] : null,
      product_count: pRows.length,
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message })
  }
}
