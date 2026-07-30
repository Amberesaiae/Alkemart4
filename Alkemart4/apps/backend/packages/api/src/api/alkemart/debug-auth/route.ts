import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" })
    return
  }

  const NEON = process.env.DEBUG_DATABASE_URL || ""
  const RAILWAY = process.env.DEBUG_DATABASE_URL_2 || ""

  try {
    const { Client } = require("pg")

    // Query both DBs
    const results: any = {}

    for (const [label, url] of [["neon", NEON], ["railway", RAILWAY]] as const) {
      const c = new Client(url)
      await c.connect()

      const tables = ["auth_identity", "provider_identity", "user", "customer"]

      for (const table of tables) {
        try {
          const { rows: schema } = await c.query(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
            [table]
          )
          const { rows: data } = await c.query(`SELECT * FROM "${table}"`)
          results[`${label}_${table}_columns`] = schema.map((r: any) => r.column_name)
          results[`${label}_${table}_count`] = data.length
          results[`${label}_${table}_data`] = data.map((r: any) => {
            const clean: any = {}
            for (const k of Object.keys(r)) {
              if (typeof r[k] === "string" && r[k].length > 100) {
                clean[k] = r[k].slice(0, 80) + "..."
              } else {
                clean[k] = r[k]
              }
            }
            return clean
          })
        } catch (e: any) {
          results[`${label}_${table}_error`] = e.message
        }
      }

      await c.end()
    }

    res.json(results)
  } catch (e: any) {
    res.status(500).json({
      error: (e as Error).message,
      stack: (e as Error).stack?.slice(0, 1000),
    })
  }
}
