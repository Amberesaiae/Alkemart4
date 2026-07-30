import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SRC = process.env.MIGRATE_SRC_DATABASE_URL || ""

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { Client } = require("pg")
    const src = new Client(SRC)
    await src.connect()

    // Read ALL products with all their relations from Railway
    const { rows: products } = await src.query(`
      SELECT * FROM product WHERE deleted_at IS NULL ORDER BY created_at
    `)
    const { rows: variants } = await src.query(`
      SELECT * FROM product_variant WHERE deleted_at IS NULL ORDER BY created_at
    `)
    const { rows: options } = await src.query(`
      SELECT * FROM product_option WHERE deleted_at IS NULL ORDER BY created_at
    `)
    const { rows: optionValues } = await src.query(`
      SELECT * FROM product_option_value WHERE deleted_at IS NULL ORDER BY created_at
    `)
    const { rows: images } = await src.query(`
      SELECT * FROM image WHERE deleted_at IS NULL ORDER BY created_at
    `)
    const { rows: tags } = await src.query(`
      SELECT pt.* FROM product_tag pt
      INNER JOIN product_tags p ON p.product_tag_id = pt.id
      WHERE p.deleted_at IS NULL
    `)
    const { rows: salesChan } = await src.query(`
      SELECT * FROM sales_channel ORDER BY created_at
    `)

    await src.end()

    // Get Medusa's product module service
    const productModule = req.scope.resolve(Modules.PRODUCT) as {
      createProducts: (data: any[]) => Promise<any>
      listProducts: (filters?: any) => Promise<any[]>
    }

    const SC_ID = salesChan[0]?.id || "sc_01KXMN56SN3RSCSP55KE3A8BD4"

    // Build product data for Medusa's module API
    const productData = products.map((p: any) => {
      const prodVariants = variants
        .filter((v: any) => v.product_id === p.id)
        .map((v: any) => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          ean: v.ean,
          upc: v.upc,
          variant_rank: v.variant_rank,
          manage_inventory: v.manage_inventory,
          allow_backorder: v.allow_backorder,
          weight: v.weight,
          length: v.length,
          height: v.height,
          width: v.width,
          origin_country: v.origin_country,
          hs_code: v.hs_code,
          mid_code: v.mid_code,
          material: v.material,
          options: optionValues
            .filter((ov: any) => ov.variant_id === v.id)
            .map((ov: any) => ({
              option_id: ov.option_id,
              value: ov.value,
            })),
        }))

      return {
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        description: p.description,
        handle: p.handle,
        status: p.status || "draft",
        thumbnail: p.thumbnail,
        weight: p.weight,
        length: p.length,
        height: p.height,
        width: p.width,
        origin_country: p.origin_country,
        hs_code: p.hs_code,
        mid_code: p.mid_code,
        material: p.material,
        discountable: p.discountable,
        external_id: p.external_id,
        images: images.filter((i: any) => i.product_id === p.id).map((i: any) => ({ id: i.id, url: i.url })),
        variants: prodVariants,
        sales_channels: [{ id: SC_ID }],
      }
    })

    // Use Medusa's module API to create products
    const created = await productModule.createProducts(productData)

    // Link all to sales channel via link module
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK) as {
      create: (args: any) => Promise<any>
    }
    let linked = 0
    for (const p of created) {
      try {
        await link.create({
          [Modules.PRODUCT]: { product_id: p.id },
          [Modules.SALES_CHANNEL]: { sales_channel_id: SC_ID },
        })
        linked++
      } catch { }
    }

    res.json({
      ok: true,
      products_created: created.length,
      products_linked: linked,
      sales_channel: SC_ID,
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message, stack: (e as Error).stack?.slice(0, 500) })
  }
}
