/**
 * Redis cache for GET /store/alkemart/catalog (P1.4).
 *
 * Keyed by (seller_handle, category_handle, limit, offset) + generation.
 * Generation bump invalidates all catalog pages without SCAN.
 *
 * Graceful: if Redis is down, get returns null and set is no-op.
 */
import Redis from "ioredis"

export type CatalogCachePayload = {
  products: unknown[]
  count: number
  limit: number
  offset: number
  filter: string
  seller_handle: string | null
  category_handle: string | null
  note?: string
  strategy?: string
  cached_at?: string
}

const GEN_KEY = "alkemart:catalog:gen"
const KEY_PREFIX = "alkemart:catalog:v1"

let client: Redis | null | undefined

function redisUrl(): string {
  return (process.env.REDIS_URL || "").trim()
}

function cacheDisabled(): boolean {
  const v = (process.env.CATALOG_CACHE_DISABLED || "").toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

/** TTL seconds — default 60, clamp 15–300. */
export function catalogCacheTtlSec(): number {
  const raw = Number(process.env.CATALOG_CACHE_TTL_SEC || 60)
  if (!Number.isFinite(raw)) return 60
  return Math.min(300, Math.max(15, Math.floor(raw)))
}

export function buildCatalogCacheKey(parts: {
  gen: number | string
  sellerHandle: string
  categoryHandle: string
  limit: number
  offset: number
}): string {
  const s = (parts.sellerHandle || "_").toLowerCase()
  const c = (parts.categoryHandle || "_").toLowerCase()
  return `${KEY_PREFIX}:g${parts.gen}:s=${s}:c=${c}:l=${parts.limit}:o=${parts.offset}`
}

function getClient(): Redis | null {
  if (cacheDisabled()) return null
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
      connectTimeout: 2000,
      // Don't block process exit in tests
      enableOfflineQueue: false,
    })
    client.on("error", (err) => {
      // Avoid crash loops; log once-style noise is fine for lab
      if (process.env.NODE_ENV !== "test") {
        console.warn("[catalog-cache] redis error:", err.message)
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

async function currentGen(r: Redis): Promise<number> {
  const v = await r.get(GEN_KEY)
  const n = v != null ? Number(v) : 0
  return Number.isFinite(n) ? n : 0
}

export async function getCatalogCache(params: {
  sellerHandle: string
  categoryHandle: string
  limit: number
  offset: number
}): Promise<CatalogCachePayload | null> {
  const r = getClient()
  if (!r) return null
  try {
    if (!(await ensureConnected(r))) return null
    const gen = await currentGen(r)
    const key = buildCatalogCacheKey({ gen, ...params })
    const raw = await r.get(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CatalogCachePayload
    if (!parsed || !Array.isArray(parsed.products)) return null
    return parsed
  } catch {
    return null
  }
}

export async function setCatalogCache(
  params: {
    sellerHandle: string
    categoryHandle: string
    limit: number
    offset: number
  },
  payload: CatalogCachePayload,
): Promise<boolean> {
  const r = getClient()
  if (!r) return false
  try {
    if (!(await ensureConnected(r))) return false
    const gen = await currentGen(r)
    const key = buildCatalogCacheKey({ gen, ...params })
    const body: CatalogCachePayload = {
      ...payload,
      cached_at: new Date().toISOString(),
    }
    await r.set(key, JSON.stringify(body), "EX", catalogCacheTtlSec())
    return true
  } catch {
    return false
  }
}

/** Bump generation → all previous catalog page keys become unreachable. */
export async function invalidateCatalogCache(
  reason?: string,
): Promise<boolean> {
  const r = getClient()
  if (!r) return false
  try {
    if (!(await ensureConnected(r))) return false
    await r.incr(GEN_KEY)
    if (process.env.NODE_ENV !== "test" && reason) {
      console.info("[catalog-cache] invalidated:", reason)
    }
    return true
  } catch {
    return false
  }
}

/** Test helper — reset singleton between unit tests. */
export function _resetCatalogCacheClientForTests(): void {
  if (client) {
    try {
      client.disconnect()
    } catch {
      /* */
    }
  }
  client = undefined
}
