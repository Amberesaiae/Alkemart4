import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { Client } = require("pg")
    const dst = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await dst.connect()

    // Check product table columns and constraints
    const { rows: cols } = await dst.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'product'
      ORDER BY ordinal_position
    `)

    const { rows: constraints } = await dst.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'product'::regclass
    `)

    // Check if deleted_at is set
    const { rows: deletedRows } = await dst.query(`SELECT COUNT(*) as cnt FROM product WHERE deleted_at IS NOT NULL`)

    // Check raw product count
    const { rows: totalRows } = await dst.query(`SELECT COUNT(*) as cnt FROM product`)

    await dst.end()

    res.json({
      total_products: parseInt(totalRows[0].cnt),
      soft_deleted: parseInt(deletedRows[0].cnt),
      columns: cols.map((c: any) => ({ name: c.column_name, type: c.data_type, nullable: c.is_nullable })),
      constraints: constraints.map((c: any) => ({ name: c.conname, type: c.contype, def: c.def })),
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message })
  }
}
