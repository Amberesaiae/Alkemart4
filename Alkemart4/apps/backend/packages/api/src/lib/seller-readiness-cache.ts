/**
 * Redis cache for seller readiness (onboarding/status).
 * Stops 15–30s multi-graph evaluations from running on every banner poll.
 */
import type { Redis } from "ioredis"
import { getRedisClient } from "./redis-client.ts"
import type { SellerReadiness } from "./seller-readiness.ts"

const KEY_PREFIX = "alkemart:seller_ready:v1:"

function disabled(): boolean {
  const v = (process.env.SELLER_READY_CACHE_DISABLED || "").toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

function getClient(): Redis | null {
  if (disabled()) return null
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
