import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { checkRateLimit } from "../../lib/simple-rate-limit.ts"

const LIMIT = Number(process.env.RATE_LIMIT_MAX) || 60
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000

export async function rateLimit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] as string | undefined ||
    req.socket?.remoteAddress ||
    "unknown"

  const result = checkRateLimit({ key: `ip:${ip}`, limit: LIMIT, windowMs: WINDOW_MS })

  if (!result.ok) {
    res.status(429).json({ error: "Too many requests. Try again later.", retryAfter: result.retryAfterSec })
    return
  }

  next()
}
