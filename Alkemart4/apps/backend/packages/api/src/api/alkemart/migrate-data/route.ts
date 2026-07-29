import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: any) => Promise<{ data: any }>
    }
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as {
      create: (args: any) => Promise<any>
    }
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER) as { info: (m: string) => void; error: (m: string) => void }

    const scResult = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
    })
    const channels = Array.isArray(scResult.data) ? scResult.data : []
    const defaultSC = channels.find((c: any) => c.name === "Default Sales Channel") || channels[0]

    if (!defaultSC) {
      res.json({ error: "No sales channel found", channels })
      return
    }

    const prodResult = await query.graph({
      entity: "product",
      fields: ["id", "title"],
    })
    const products = Array.isArray(prodResult.data) ? prodResult.data : []
    if (products.length === 0) {
      res.json({ error: "No products found to link", salesChannel: defaultSC })
      return
    }

    const existingLinks = await query.graph({
      entity: "product_sales_channel",
      fields: ["product_id", "sales_channel_id"],
    })
    const existingSet = new Set(
      (Array.isArray(existingLinks.data) ? existingLinks.data : []).map(
        (l: any) => `${l.product_id}::${l.sales_channel_id}`
      )
    )

    let linked = 0
    const errors: string[] = []

    for (const p of products) {
      const key = `${p.id}::${defaultSC.id}`
      if (existingSet.has(key)) continue

      try {
        await link.create({
          [Modules.PRODUCT]: { product_id: p.id },
          [Modules.SALES_CHANNEL]: { sales_channel_id: defaultSC.id },
        })
        linked++
      } catch (e: any) {
        errors.push(`${p.id}: ${e.message.substring(0, 80)}`)
        logger.error(`[migrate] link failed for product ${p.id}: ${e.message}`)
      }
    }

    res.json({
      ok: true,
      salesChannel: defaultSC,
      totalProducts: products.length,
      linked,
      existing: existingSet.size,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 500) })
  }
}
