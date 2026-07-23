import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { trackSearch } from "../../../../lib/search-history"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const did = (req.headers["x-device-id"] as string) || ""
  const body = (req.body ?? {}) as { query?: string }
  if (did && body.query) await trackSearch({ deviceId: did, query: body.query })
  res.status(200).json({ ok: true })
}
