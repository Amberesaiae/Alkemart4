/**
 * In-process sliding window rate limit (single instance).
 * Good enough for lab + single-node; edge rate limits for multi-instance.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function checkRateLimit(opts: {
  key: string
  /** Max hits in the window */
  limit: number
  /** Window ms */
  windowMs: number
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const b = buckets.get(opts.key)
  if (!b || now >= b.resetAt) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs })
    return { ok: true }
  }
  if (b.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    }
  }
  b.count += 1
  return { ok: true }
}

/** Periodic cleanup to avoid unbounded growth */
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k)
  }
}, 60_000).unref?.()
