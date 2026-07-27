/**
 * Short-lived Redis cache of seller → owned product ids.
 * Avoids re-querying product_seller on every GET /vendor/products
 * (seller UI fires this often). TTL is short; create hook invalidates.
 */
import type { Redis } from "ioredis"
import { getRedisClient } from "./redis-client"
import { logger } from "./logger"

const KEY_PREFIX = "alkemart:seller_owned:v1:"

function disabled(): boolean {
  const v = (process.env.SELLER_OWNED_CACHE_DISABLED || "").toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

export function sellerOwnedCacheTtlSec(): number {
  const raw = Number(process.env.SELLER_OWNED_CACHE_TTL_SEC || 45)
  if (!Number.isFinite(raw)) return 45
  return Math.min(120, Math.max(10, Math.floor(raw)))
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

function keyFor(sellerId: string): string {
  return `${KEY_PREFIX}${sellerId}`
}

export async function getCachedOwnedProductIds(
  sellerId: string,
): Promise<string[] | null> {
  if (!sellerId) return null
  const r = getClient()
  if (!r) return null
  try {
    if (!(await ensureConnected(r))) return null
    const raw = await r.get(keyFor(sellerId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((x): x is string => typeof x === "string" && !!x)
  } catch {
    logger.warn("[seller-owned-products-cache] Redis error in getCachedOwnedProductIds")
    return null
  }
}

export async function setCachedOwnedProductIds(
  sellerId: string,
  ids: string[],
): Promise<void> {
  if (!sellerId) return
  const r = getClient()
  if (!r) return
  try {
    if (!(await ensureConnected(r))) return
    await r.set(
      keyFor(sellerId),
      JSON.stringify(ids),
      "EX",
      sellerOwnedCacheTtlSec(),
    )
  } catch {
    logger.warn("[seller-owned-products-cache] Redis error in setCachedOwnedProductIds")
  }
}

export async function invalidateSellerOwnedProductIds(
  sellerId: string,
): Promise<void> {
  if (!sellerId) return
  const r = getClient()
  if (!r) return
  try {
    if (!(await ensureConnected(r))) return
    await r.del(keyFor(sellerId))
  } catch {
    logger.warn("[seller-owned-products-cache] Redis error in invalidateSellerOwnedProductIds")
  }
}

export function _resetSellerOwnedCacheClientForTests(): void {
  /* no-op — shared redis-client handles lifecycle */
}
