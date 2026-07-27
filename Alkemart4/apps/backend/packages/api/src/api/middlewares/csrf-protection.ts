import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { logger } from "../../lib/logger"

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function normalizeOrigin(input: string): string {
  try {
    const u = new URL(input)
    return `${u.protocol}//${u.host}`.toLowerCase()
  } catch {
    return input.toLowerCase()
  }
}

function originMatches(pattern: string, origin: string): boolean {
  if (pattern === origin) return true
  if (pattern.startsWith("http://") && origin === pattern.replace(/\/$/, "")) return true
  if (pattern.startsWith("https://") && origin === pattern.replace(/\/$/, "")) return true
  return false
}

export function csrfProtection(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next()
    return
  }

  const origin = (req.headers["origin"] as string | undefined) || ""
  const referer = (req.headers["referer"] as string | undefined) || ""

  const source = origin || referer

  if (!source) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("[csrf] request with no Origin/Referer rejected", { path: req.path, method: req.method })
      res.status(403).json({ error: "origin required" })
      return
    }
    next()
    return
  }

  if (ALLOWED_ORIGINS.length > 0) {
    const normalized = normalizeOrigin(source)
    const match = ALLOWED_ORIGINS.some((o) => originMatches(o, normalized))
    if (!match) {
      logger.warn("[csrf] origin not allowed", { source: normalized, path: req.path })
      res.status(403).json({ error: "origin not allowed" })
      return
    }
    next()
    return
  }

  const host = req.headers["host"] || ""
  const selfOrigin = `http://${host}`.toLowerCase()
  const selfOriginHttps = `https://${host}`.toLowerCase()
  const normalized = normalizeOrigin(source)

  if (normalized === selfOrigin || normalized === selfOriginHttps) {
    next()
    return
  }

  logger.warn("[csrf] potential CSRF attack", { source: normalized, host, path: req.path, method: req.method })
  res.status(403).json({ error: "origin mismatch" })
}
