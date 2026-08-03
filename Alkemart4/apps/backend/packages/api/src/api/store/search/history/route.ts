import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { checkRateLimit } from "../../../../lib/simple-rate-limit.ts"
import {
  getSearchHistory,
  removeSearchQuery,
  clearSearchHistory,
} from "../../../../lib/search-history.ts"

function deviceId(req: MedusaRequest): string {
  return (req.headers["x-device-id"] as string) || ""
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const did = deviceId(req)
  if (!did) return res.status(200).json({ recent: [], frequent: [] })
  const result = await getSearchHistory({ deviceId: did })
  res.status(200).json(result)
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const did = deviceId(req)
  if (!did) return res.status(200).json({ ok: true })

  const { ok } = checkRateLimit({ key: `search-history:delete:${did}`, limit: 5, windowMs: 60_000 })
  if (!ok) {
    return res.status(429).json({ error: "Too many delete requests. Try again later." })
  }

  const body = (req.body ?? {}) as { query?: string }
  if (body.query) await removeSearchQuery({ deviceId: did, query: body.query })
  else await clearSearchHistory({ deviceId: did })
  res.status(200).json({ ok: true })
}
