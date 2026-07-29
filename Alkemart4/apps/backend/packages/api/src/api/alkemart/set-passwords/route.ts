import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

const SECRET = "alkemart-fix-2026"
const DEFAULT_PASS = "test123"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { secret, email, password } = (req.body || {}) as Record<string, unknown>
    if (secret !== SECRET) {
      return res.status(403).json({ error: "invalid secret" })
    }

    const authService = req.scope.resolve(Modules.AUTH)
    const pwd = password || DEFAULT_PASS

    if (email) {
      // Set password for one account
      const result = await authService.updateProvider("emailpass", {
        entity_id: email,
        password: pwd,
      })
      return res.json({ ok: true, email, ...result })
    }

    // Set password for all non-deleted provider identities
    const { Client } = require("pg")
    const db = new Client(
      "postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )
    await db.connect()

    const { rows: identities } = await db.query(
      `SELECT pi.entity_id FROM provider_identity pi
       WHERE pi.deleted_at IS NULL AND pi.provider = 'emailpass'
       ORDER BY pi.entity_id`
    )

    const results: any[] = []
    for (const row of identities) {
      try {
        const result = await authService.updateProvider("emailpass", {
          entity_id: row.entity_id,
          password: pwd,
        })
        results.push({ email: row.entity_id, success: result.success })
      } catch (e: any) {
        results.push({ email: row.entity_id, error: e.message })
      }
    }

    await db.end()

    res.json({ ok: true, total: identities.length, results, password: pwd })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
}
