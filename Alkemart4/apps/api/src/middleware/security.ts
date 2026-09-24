import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../context"

/** Best-effort per-isolate counters (Workers isolates are ephemeral). */
const hits = new Map<string, { n: number; resetAt: number }>()

/**
 * Test-only reset for the per-isolate counters. Test runners share one
 * process across files while every request arrives without a client IP,
 * so files must reset in isolation — production isolates never call this.
 */
export function resetRateLimits(): void {
  hits.clear()
}

function clientKey(c: { req: { header: (n: string) => string | undefined } }): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown"
  )
}

/**
 * Security headers + lightweight rate limit for auth/checkout write paths.
 * Not a substitute for Cloudflare WAF / Rate Limiting rules in production.
 */
export const securityMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path = c.req.path
  const method = c.req.method.toUpperCase()
  const sensitive =
    (method !== "GET" &&
      method !== "OPTIONS" &&
      (path.startsWith("/store/auth") ||
        path.startsWith("/vendor/auth") ||
        path.startsWith("/admin/auth") ||
        path === "/store/checkout" ||
        path === "/store/orders/lookup" ||
        path.startsWith("/store/cart") ||
        path.startsWith("/store/reviews") ||
        path.startsWith("/store/subscriptions") ||
        path.startsWith("/hooks/"))) ||
    // Experiment exposure writes happen on GET by design; cap them too.
    path.startsWith("/store/experiments")

  if (sensitive) {
    const key = `${clientKey(c)}:${path}`
    const now = Date.now()
    const windowMs = 60_000
    const max = path.startsWith("/hooks/") ? 120 : 30
    // Sweep expired keys before inserting. Without this the map retains one
    // entry per (IP, path) seen for the isolate's whole life.
    if (hits.size > 1000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
    }
    let row = hits.get(key)
    if (!row || row.resetAt <= now) {
      row = { n: 0, resetAt: now + windowMs }
      hits.set(key, row)
    }
    row.n += 1
    if (row.n > max) {
      return c.json({ error: "rate_limited" }, 429)
    }
  }

  await next()

  c.header("X-Content-Type-Options", "nosniff")
  c.header("Referrer-Policy", "strict-origin-when-cross-origin")
  c.header("X-Frame-Options", "DENY")
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  )
  return c.res
}
