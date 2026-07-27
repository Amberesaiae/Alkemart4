import type { Redis } from "ioredis"
import { getRedisClient } from "./redis-client"
import { logger } from "./logger"

const KEY_PREFIX = "alkemart:ratelimit:v1:"

function getClient(): Redis | null {
  return getRedisClient()
}

async function ensureConnected(r: Redis): Promise<boolean> {
  try {
    if (r.status === "wait" || r.status === "end") {
      await r.connect()
    }
    return true
  } catch {
    return false
  }
}

// TODO: Replace with Redis-backed rate limiter for multi-instance deployments
export async function checkRateLimit(
  key: string,
  max: number = 10,
  windowMs: number = 60_000,
): Promise<boolean> {
  const r = getClient()
  if (!r) {
    logger.warn("[rate-limiter] Redis unavailable — rate limiting disabled")
    return true
  }
  try {
    if (!(await ensureConnected(r))) return true
    const redisKey = `${KEY_PREFIX}${key}`
    const current = await r.incr(redisKey)
    if (current === 1) {
      await r.pexpire(redisKey, windowMs)
    }
    return current <= max
  } catch (e) {
    logger.warn("[rate-limiter] Redis error — rate limiting disabled", { error: e instanceof Error ? e.message : e })
    return true
  }
}
