import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway"

const TABLE_ORDER = [
  "currency", "region", "region_country", "region_payment_provider",
  "tax_region", "tax_provider", "payment_provider",
  "sales_channel", "store", "store_currency",
  "shipping_profile", "fulfillment_provider", "fulfillment_set", "service_zone", "geo_zone",
  "stock_location", "stock_location_address",
  "seller", "seller_address", "seller_member", "member",
  "user", "user_rbac_role",
  "rbac_policy", "rbac_role", "rbac_role_policy",
  "auth_identity", "auth_password_reset_token", "auth_verification", "auth_mfa_factor", "auth_mfa_recovery_code",
  "provider_identity",
  "api_key", "publishable_api_key_sales_channel",
  "invite", "customer", "customer_address", "customer_group", "customer_group_customer", "customer_account_holder",
  "account_holder",
  "product", "product_category", "product_category_product", "product_collection",
  "product_type", "product_tag", "product_tags",
  "product_option", "product_option_value",
  "product_variant", "product_variant_option",
  "image", "product_product_option", "product_product_option_value",
  "product_seller", "product_sales_channel",
  "product_attribute", "product_attribute_value", "product_attribute_value_link",
  "price_set", "price", "price_list", "price_list_rule", "price_rule", "price_preference",
  "product_variant_price_set",
  "inventory_item", "inventory_level",
  "location_fulfillment_provider", "location_fulfillment_set",
  "fulfillment_shipping_profile_seller_seller", "fulfillment_shipping_option_seller_seller",
  "shipping_option", "shipping_option_type", "shipping_option_rule", "shipping_option_price_set",
  "sales_channel_stock_location", "stock_location_stock_location_seller_seller",
  "inventory_inventory_item_seller_seller", "offer_inventory_item",
  "offer", "offer_offer_pricing_price",
  "product_change", "product_change_action",
  "cart", "cart_address", "cart_line_item", "cart_line_item_adjustment",
  "cart_line_item_tax_line", "cart_shipping_method", "cart_shipping_method_adjustment",
  "cart_shipping_method_tax_line", "cart_payment_collection", "cart_promotion",
  "payment", "payment_collection", "payment_session", "payment_details",
  "payment_collection_payment_providers",
  "order_address", "order_cart",
  "order_shipping_method", "order_shipping_method_tax_line",
  "fulfillment", "fulfillment_address", "fulfillment_item", "fulfillment_label",
  "refund", "refund_reason", "return", "return_item",
  "notification",
]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { Client } = require("pg")
    const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } })
    await src.connect()

    const dst = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await dst.connect()

    let total = 0
    const results: string[] = []

    for (const table of TABLE_ORDER) {
      try {
        const { rows } = await src.query(`SELECT * FROM "${table}"`)
        if (rows.length === 0) { results.push(`${table}: 0 rows`); continue }

        const cols = Object.keys(rows[0])
        const colList = cols.map(c => `"${c}"`).join(", ")

        await dst.query(`DELETE FROM "${table}"`)

        const CHUNK = 100
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK)
          const values: any[] = []
          const phs: string[] = []
          let idx = 1

          for (const row of chunk) {
            const rph: string[] = []
            for (const col of cols) {
              let val = (row as any)[col]
              if (val === undefined) val = null
              if (typeof val === "object" && val !== null) val = JSON.stringify(val)
              values.push(val)
              rph.push(`$${idx++}`)
            }
            phs.push(`(${rph.join(",")})`)
          }

          await dst.query(`INSERT INTO "${table}" (${colList}) VALUES ${phs.join(",")} ON CONFLICT DO NOTHING`, values)
        }

        total += rows.length
        results.push(`${table}: ${rows.length} rows ✓`)
      } catch (e: any) {
        results.push(`${table}: FAILED — ${(e as Error).message.substring(0, 100)}`)
      }
    }

    await src.end()
    await dst.end()

    // Now link all products to default sales channel using Medusa's link API
    try {
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

      if (sc) {
        const prodResult = await query.graph({
          entity: "product",
          fields: ["id"],
        })
        const products = Array.isArray(prodResult.data) ? prodResult.data : []

        let linked = 0
        for (const p of products) {
          try {
            await link.create({
              [Modules.PRODUCT]: { product_id: p.id },
              [Modules.SALES_CHANNEL]: { sales_channel_id: sc.id },
            })
            linked++
          } catch { /* may exist */ }
        }
        results.push(`product_sales_channel_links: ${linked} created`)
      }
    } catch (e: any) {
      results.push(`product_sales_channel_links: FAILED — ${(e as Error).message.substring(0, 100)}`)
    }

    res.json({ ok: true, total, tables: results })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message })
  }
}
