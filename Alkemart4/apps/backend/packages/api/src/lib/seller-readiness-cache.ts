/**
 * Redis cache for seller readiness (onboarding/status).
 * Stops 15–30s multi-graph evaluations from running on every banner poll.
 */
import Redis from "ioredis"
import type { SellerReadiness } from "./seller-readiness"

const KEY_PREFIX = "alkemart:seller_ready:v1:"

let client: Redis | null | undefined

function redisUrl(): string {
  return (process.env.REDIS_URL || "").trim()
}

function disabled(): boolean {
  const v = (process.env.SELLER_READY_CACHE_DISABLED || "").toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

function getClient(): Redis | null {
  if (disabled()) return null
  if (client !== undefined) return client
  const url = redisUrl()
  if (!url) {
    client = null
    return null
  }
  try {
    client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 1500,
      enableOfflineQueue: false,
    })
    client.on("error", (err) => {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[seller-ready-cache] redis error:", err.message)
      }
    })
    return client
  } catch {
    client = null
    return null
  }
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

export async function getCachedSellerReadiness(
  sellerId: string,
): Promise<SellerReadiness | null> {
  if (!sellerId) return null
  const r = getClient()
  if (!r) return null
  try {
    if (!(await ensureConnected(r))) return null
    const raw = await r.get(`${KEY_PREFIX}${sellerId}`)
    if (!raw) return null
    return JSON.parse(raw) as SellerReadiness
  } catch {
    return null
  }
}

export async function setCachedSellerReadiness(
  sellerId: string,
  payload: SellerReadiness,
  ttlSec = 60,
): Promise<void> {
  if (!sellerId) return
  const r = getClient()
  if (!r) return
  try {
    if (!(await ensureConnected(r))) return
    const ttl = Math.min(180, Math.max(15, Math.floor(ttlSec)))
    await r.set(
      `${KEY_PREFIX}${sellerId}`,
      JSON.stringify(payload),
      "EX",
      ttl,
    )
  } catch {
    /* best-effort */
  }
}

export async function invalidateSellerReadiness(
  sellerId: string,
): Promise<void> {
  if (!sellerId) return
  const r = getClient()
  if (!r) return
  try {
    if (!(await ensureConnected(r))) return
    await r.del(`${KEY_PREFIX}${sellerId}`)
  } catch {
    /* */
  }
}
