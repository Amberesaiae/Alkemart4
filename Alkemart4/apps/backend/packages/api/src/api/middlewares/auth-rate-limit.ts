import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { checkRateLimit } from "../../lib/rate-limiter.ts"
import { logger } from "../../lib/logger.ts"

const MAX_ATTEMPTS = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10
const WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60_000

export async function authRateLimit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] as string | undefined ||
    req.socket?.remoteAddress ||
    "unknown"

  const email = (req.body as { email?: string } | undefined)?.email || ""
  const key = `auth:${ip}:${email}`
  const allowed = await checkRateLimit(key, MAX_ATTEMPTS, WINDOW_MS)

  if (!allowed) {
    logger.warn("[auth] rate limit exceeded", { ip, email: email ? `${email.slice(0, 3)}***` : "none" })
    res.status(429).json({ error: "Too many requests. Try again later." })
    return
  }

  next()
}
