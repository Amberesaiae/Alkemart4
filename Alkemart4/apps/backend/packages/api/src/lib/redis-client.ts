import Redis from "ioredis"

let client: Redis | null = null

export function getRedisClient(): Redis | null {
  if (client) return client
  const url = (process.env.REDIS_URL || "").trim()
  if (!url) return null
  try {
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3, retryStrategy: (times) => Math.min(times * 200, 5000) })
    client.connect().catch((err) => {
      console.warn("[redis] connection failed", err instanceof Error ? err.message : err)
      client = null
    })
    return client
  } catch (err) {
    console.warn("[redis] init failed", err instanceof Error ? err.message : err)
    return null
  }
}
