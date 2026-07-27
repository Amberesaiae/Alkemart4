import Redis from "ioredis"

const KEY_PREFIX = "alkemart:ratelimit:v1:"

let client: Redis | null | undefined

function redisUrl(): string {
  return (process.env.REDIS_URL || "").trim()
}

function getClient(): Redis | null {
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
        console.warn("[rate-limiter] redis error:", err.message)
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

export async function checkRateLimit(
  key: string,
  max: number = 10,
  windowMs: number = 60_000,
): Promise<boolean> {
  const r = getClient()
  if (!r) {
    console.warn("[rate-limiter] Redis unavailable — rate limiting disabled")
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
    console.warn("[rate-limiter] Redis error — rate limiting disabled", e instanceof Error ? e.message : e)
    return true
  }
}
