import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../context"
import { enforceGlobalLimit } from "../lib/auth-rate-limit"

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
    "unknown"
  )
}

/**
 * Security headers + lightweight rate limit for auth/checkout write paths.
 * Not a substitute for Cloudflare WAF / Rate Limiting rules in production.
 */
export const securityMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff")
  c.header("Referrer-Policy", "strict-origin-when-cross-origin")
  c.header("X-Frame-Options", "DENY")
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  const path = c.req.path
  const method = c.req.method.toUpperCase()
  const sensitive =
    (method !== "GET" &&
      method !== "OPTIONS" &&
      (path.startsWith("/store/auth") ||
        path.startsWith("/store/account") ||
        path.startsWith("/store/newsletter") ||
        path.startsWith("/vendor/auth") ||
        path.startsWith("/admin/auth") ||
        path === "/store/checkout" ||
        path.startsWith("/store/orders/") ||
        path.startsWith("/store/cart") ||
        path.startsWith("/store/reviews") ||
        path.startsWith("/store/subscriptions") ||
        path.startsWith("/store/messages") ||
        path.startsWith("/store/compare") ||
        path.startsWith("/store/deals") ||
        path.startsWith("/store/questions") ||
        path.startsWith("/hooks/"))) ||
    // Experiment exposure writes happen on GET by design; cap them too.
    path.startsWith("/store/experiments") ||
    // Street search is forwarded to a geocoder with its own usage limits.
    path.startsWith("/store/places/")

  if (sensitive) {
    const auth = /^\/(store|vendor|admin)\/auth(?:\/|$)/.test(path)
    const checkout = path === "/store/checkout"
    if (auth || checkout) {
      const bucket = auth ? `${path.split("/")[1]}:auth` : "checkout"
      await enforceGlobalLimit(c, bucket, clientKey(c), checkout ? 10 : 30, 60_000)
    }
    const key = `${clientKey(c)}:${path}`
    const now = Date.now()
    const windowMs = 60_000
    const max = path.startsWith("/hooks/") ? 120 : path.startsWith("/store/places/") ? 40 : 30
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
      c.header("Retry-After", String(Math.max(1, Math.ceil((row.resetAt - now) / 1000))))
      return c.json({ error: "rate_limited" }, 429)
    }
  }

  await next()
  return c.res
}
