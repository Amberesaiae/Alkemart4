import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../context"

export type RateLimitDecision = { allowed: boolean; retryAfter: number }
export type RateLimitNamespace = {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): { fetch(request: Request): Promise<Response> }
}

/** One object per hashed principal/bucket: globally shared, not isolate-local. */
export class AuthRateLimiter {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const { limit, windowMs } = await request.json() as { limit: number; windowMs: number }
    if (!Number.isInteger(limit) || limit < 1 || limit > 120 ||
      !Number.isInteger(windowMs) || windowMs < 1000 || windowMs > 900_000) {
      return new Response("Invalid policy", { status: 400 })
    }
    const result = await this.state.storage.transaction(async (tx) => {
      const now = Date.now()
      let row = await tx.get<{ count: number; resetAt: number }>("window")
      if (!row || row.resetAt <= now) row = { count: 0, resetAt: now + windowMs }
      const allowed = row.count < limit
      if (allowed) row.count += 1
      await tx.put("window", row)
      await tx.setAlarm(row.resetAt)
      return { allowed, retryAfter: Math.max(1, Math.ceil((row.resetAt - now) / 1000)) }
    })
    return Response.json(result)
  }

  async alarm() { await this.state.storage.deleteAll() }
}

export async function enforceGlobalLimit(c: Context<AppEnv>, bucket: string, principal: string, limit: number, windowMs: number) {
  const env = c.env
  const ns = env?.AUTH_RATE_LIMITER
  if (!ns) {
    if (env?.ENVIRONMENT === "production") throw new HTTPException(503, { message: "auth_protection_unavailable" })
    return // Local unit tests use the existing per-isolate limiter.
  }
  // Never persist email/IP as an object name. Fixed buckets prevent random path bypass.
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${bucket}:${principal}`))
  const key = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
  try {
    const res = await ns.get(ns.idFromName(key)).fetch(new Request("https://limiter.internal/consume", {
      method: "POST", body: JSON.stringify({ limit, windowMs }),
    }))
    if (!res.ok) throw new Error("limiter failed")
    const decision = await res.json() as RateLimitDecision
    if (typeof decision.allowed !== "boolean" || !Number.isFinite(decision.retryAfter)) throw new Error("invalid limiter response")
    if (!decision.allowed) {
      c.header("Retry-After", String(Math.max(1, Math.ceil(decision.retryAfter))))
      throw new HTTPException(429, { message: "rate_limited" })
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error
    throw new HTTPException(503, { message: "auth_protection_unavailable" })
  }
}

/** Bounded account attempts stop distributed-IP brute force without permanent lockout. */
export function limitAccountAttempts(c: Context<AppEnv>, role: string, email: string) {
  return enforceGlobalLimit(c, `login-account:${role}`, email, 10, 15 * 60_000)
}
