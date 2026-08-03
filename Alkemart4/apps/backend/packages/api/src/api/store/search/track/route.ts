import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { trackSearch } from "../../../../lib/search-history.ts"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const did = typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : ""
  const body = (req.body ?? {}) as Record<string, unknown>
  const query = typeof body.query === "string" ? body.query.slice(0, 200) : ""
  if (did && query) await trackSearch({ deviceId: did, query })
  res.status(200).json({ ok: true })
}
