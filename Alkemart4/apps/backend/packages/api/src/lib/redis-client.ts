import { logger } from "./logger"
import Redis from "ioredis"

let client: Redis | null = null

export function getRedisClient(): Redis | null {
  if (client) return client
  const url = (process.env.REDIS_URL || "").trim()
  if (!url) return null
  try {
    client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3, retryStrategy: (times) => Math.min(times * 200, 5000) })
    client.connect().catch((err) => {
      logger.warn("[redis] connection failed", { error: err instanceof Error ? err.message : err })
      client = null
    })
    return client
  } catch (err) {
    logger.warn("[redis] init failed", { error: err instanceof Error ? err.message : err })
    return null
  }
}
