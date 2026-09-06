import type { MiddlewareHandler } from "hono"
import type { AppEnv } from "../context"

const DEFAULT_ORIGINS = [
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5177",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  // Production Vercel frontends (canonical)
  "https://alkemart-storefront.vercel.app",
  "https://alkemart.vercel.app",
  // Optional Cloudflare Pages mirrors
  "https://alkemart4-storefront.pages.dev",
  "https://alkemart4-vendor.pages.dev",
  "https://alkemart4-admin.pages.dev",
]

function allowedOrigins(env: unknown): Set<string> {
  const raw = (env as { ALLOWED_ORIGINS?: string } | undefined)?.ALLOWED_ORIGINS
  const extras = raw
    ? raw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : []
  return new Set([...DEFAULT_ORIGINS, ...extras])
}

export const corsMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const origin = c.req.header("Origin")
  const allowed = allowedOrigins(c.env)
  const ok = origin && allowed.has(origin)

  if (c.req.method === "OPTIONS") {
    if (ok && origin) {
      c.header("Access-Control-Allow-Origin", origin)
      c.header("Access-Control-Allow-Credentials", "true")
      c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
      c.header(
        "Access-Control-Allow-Headers",
        "Authorization,Content-Type,X-Requested-With,X-Seller-Id",
      )
      c.header("Access-Control-Max-Age", "86400")
      c.header("Vary", "Origin")
    }
    return c.body(null, 204)
  }

  await next()

  if (ok && origin) {
    c.header("Access-Control-Allow-Origin", origin)
    c.header("Access-Control-Allow-Credentials", "true")
    c.header("Vary", "Origin")
  }
  return undefined
}
