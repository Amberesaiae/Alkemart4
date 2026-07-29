import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { Client } = require("pg")
    const dst = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await dst.connect()

    // Fix 1: restore soft-deleted products
    const restoreResult = await dst.query(`UPDATE product SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    const restoreCount = restoreResult.rowCount

    // Fix 2: restore soft-deleted variants
    const restoreVarResult = await dst.query(`UPDATE product_variant SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)

    // Check what we have now
    const { rows: statusRows } = await dst.query(`SELECT status, COUNT(*) as cnt FROM product GROUP BY status`)
    const { rows: deletedCheck } = await dst.query(`SELECT COUNT(*) as cnt FROM product WHERE deleted_at IS NOT NULL`)
    const { rows: totalRows } = await dst.query(`SELECT COUNT(*) as cnt FROM product`)

    await dst.end()

    // Now link all products to default sales channel via Medusa link API
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as {
      create: (args: any) => Promise<any>
    }
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: any) => Promise<{ data: any }>
    }

    const scResult = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
    })
    const channels = Array.isArray(scResult.data) ? scResult.data : []
    const sc = channels.find((c: any) => c.name === "Default Sales Channel") || channels[0]

    let linked = 0
    if (sc) {
      const prodResult = await query.graph({
        entity: "product",
        fields: ["id"],
      })
      const products = Array.isArray(prodResult.data) ? prodResult.data : []
      for (const p of products) {
        try {
          await link.create({
            [Modules.PRODUCT]: { product_id: p.id },
            [Modules.SALES_CHANNEL]: { sales_channel_id: sc.id },
          })
          linked++
        } catch { /* may exist */ }
      }
    }

    res.json({
      ok: true,
      restored_products: restoreCount,
      restored_variants: restoreVarResult.rowCount,
      statuses: statusRows,
      remaining_deleted: parseInt(deletedCheck[0].cnt),
      total_products: parseInt(totalRows[0].cnt),
      products_linked_to_sc: linked,
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message })
  }
}
