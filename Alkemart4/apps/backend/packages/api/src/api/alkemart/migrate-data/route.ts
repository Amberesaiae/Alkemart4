import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: any) => Promise<{ data: any }>
    }
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as {
      create: (args: any) => Promise<any>
    }

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
      res.json({ error: "No products found to link", salesChannel: defaultSC, allProducts: [] })
      return
    }

    let linked = 0
    const skipped: string[] = []

    const existingLinks = await query.graph({
      entity: "product_sales_channel",
      fields: ["product_id", "sales_channel_id"],
    })
    const existingSet = new Set(
      (Array.isArray(existingLinks.data) ? existingLinks.data : []).map(
        (l: any) => `${l.product_id}::${l.sales_channel_id}`
      )
    )

    for (const p of products) {
      const key = `${p.id}::${defaultSC.id}`
      if (existingSet.has(key)) {
        skipped.push(p.id)
        continue
      }
      await link.create({
        product_sales_channel: {
          product_id: p.id,
          sales_channel_id: defaultSC.id,
        },
      })
      linked++
    }

    res.json({
      ok: true,
      salesChannel: defaultSC,
      totalProducts: products.length,
      linked,
      skipped: skipped.length,
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 500) })
  }
}
