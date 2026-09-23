import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import type { ApiEnv } from "./env"

/**
 * One client per request, on purpose. Workers forbids using I/O objects
 * (like postgres sockets) created inside one request's context from another
 * request's handler — "Cannot perform I/O on behalf of a different request".
 * A Hyperdrive connection string is only obtainable inside a request, so
 * global-scope pooling is impossible; over Hyperdrive the per-request cost
 * is a local handshake, not a Postgres connection.
 */
export function catalogDb(env: ApiEnv) {
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 5 })
  return drizzle(sql)
}

export function primaryDb(env: ApiEnv) {
  const sql = postgres(env.HYPERDRIVE_PRIMARY.connectionString, { max: 5 })
  return drizzle(sql)
}

const TRANSIENT_DB_ERRORS = /CONNECT_TIMEOUT|ECONNRESET|EPIPE|ETIMEDOUT|connection timeout|too many clients/i

/**
 * Retry read-only DB work across transient pooler/network blips. First
 * principles: a dropped TCP handshake must never become a 500 when the next
 * attempt succeeds — but only connection-level errors retry, never constraint
 * violations or query bugs. Backoff stays inside Workers' execution budget.
 */
export async function withTransientRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      last = error
      const transient =
        attempt < attempts && TRANSIENT_DB_ERRORS.test(error instanceof Error ? error.message : String(error))
      if (!transient) throw error
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)))
    }
  }
  throw last
}
