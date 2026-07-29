import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { Client } = require("pg")
    const dst = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await dst.connect()

    // List all tables and find product-related ones
    const { rows: tables } = await dst.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
    const prodTables = tables
      .map((r: any) => r.table_name)
      .filter((t: string) => t.includes("product"))

    const info: any = {}

    for (const t of prodTables) {
      const { rows } = await dst.query(`SELECT COUNT(*) as cnt FROM "${t}"`)
      info[t] = parseInt(rows[0].cnt)
    }

    await dst.end()

    // Now query via Medusa
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
      graph: (args: any) => Promise<{ data: any }>
    }

    const pm = req.scope.resolve(Modules.PRODUCT) as any

    res.json({
      product_tables: info,
      module_methods: Object.keys(pm).filter(k => k.startsWith("list") || k.startsWith("retrieve")).slice(0, 20),
    })
  } catch (e: any) {
    res.status(500).json({ error: (e as Error).message })
  }
}
