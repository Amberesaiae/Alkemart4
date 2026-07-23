import Redis from "ioredis"

const REDIS_URL = (process.env.REDIS_URL || "").trim()

let client: Redis | null | undefined

function getClient(): Redis | null {
  if (client === undefined) {
    if (!REDIS_URL) {
      client = null
    } else {
      try {
        client = new Redis(REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          retryStrategy: () => null,
        })
        client.connect().catch(() => {
          client!.disconnect()
          client = null
        })
      } catch {
        client = null
      }
    }
  }
  return client
}

const RECENT_KEY = (did: string) => `alk:history:recent:${did}`
const FREQ_KEY = "alk:history:freq"
const RECENT_MAX = 10
const FREQ_MAX = 10
const TTL_SEC = 90 * 24 * 3600

export async function trackSearch(opts: { deviceId: string; query: string }) {
  const r = getClient()
  if (!r) return
  const q = opts.query.trim().toLowerCase()
  if (!q) return
  const recentKey = RECENT_KEY(opts.deviceId)
  await r.lrem(recentKey, 1, q)
  await r.lpush(recentKey, q)
  await r.ltrim(recentKey, 0, RECENT_MAX - 1)
  await r.expire(recentKey, TTL_SEC)
  await r.zincrby(FREQ_KEY, 1, q)
  await r.expire(FREQ_KEY, TTL_SEC)
}

export async function getSearchHistory(opts: { deviceId: string }): Promise<{
  recent: string[]
  frequent: string[]
}> {
  const r = getClient()
  if (!r) return { recent: [], frequent: [] }
  const [recent, freq] = await Promise.all([
    r.lrange(RECENT_KEY(opts.deviceId), 0, RECENT_MAX - 1),
    r.zrevrange(FREQ_KEY, 0, FREQ_MAX - 1),
  ])
  return { recent, frequent: freq }
}

export async function removeSearchQuery(opts: { deviceId: string; query: string }) {
  const r = getClient()
  if (!r) return
  const q = opts.query.trim().toLowerCase()
  await r.lrem(RECENT_KEY(opts.deviceId), 0, q)
  await r.zincrby(FREQ_KEY, -1, q)
}

export async function clearSearchHistory(opts: { deviceId: string }) {
  const r = getClient()
  if (!r) return
  await r.del(RECENT_KEY(opts.deviceId))
}
