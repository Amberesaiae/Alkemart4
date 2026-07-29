import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { Client } = require("pg")
    const dst = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await dst.connect()

    // restore soft-deletes
    await dst.query(`UPDATE product SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE product_variant SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE product_option SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE product_option_value SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)
    await dst.query(`UPDATE image SET deleted_at = NULL WHERE deleted_at IS NOT NULL`)

    // Find all tables related to api key and publishable
    const { rows: tables } = await dst.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name ILIKE '%api_key%' OR table_name ILIKE '%publishable%')
      ORDER BY table_name
    `)
    // Check columns in relevant tables
    const tableData: Record<string, any> = {}
    for (const t of tables) {
      const { rows: cols } = await dst.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${t.table_name}'
        ORDER BY ordinal_position
      `)
      const { rows: data } = await dst.query(`SELECT * FROM "${t.table_name}" LIMIT 5`)
      tableData[t.table_name] = { columns: cols, data }
    }

    // Also check product_sales_channel table
    const { rows: pscCols } = await dst.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product_sales_channel'
      ORDER BY ordinal_position
    `)
    const { rows: pscDataSample } = await dst.query(`SELECT * FROM product_sales_channel LIMIT 5`)

    await dst.end()

    res.json({
      api_key_tables: tables.map((t: any) => t.table_name),
      table_details: tableData,
      product_sales_channel_columns: pscCols,
      product_sales_channel_sample: pscDataSample,
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message })
  }
}
