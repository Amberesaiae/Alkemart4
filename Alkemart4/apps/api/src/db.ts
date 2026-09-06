import postgres from "postgres"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { ApiEnv } from "./env"

/**
 * One postgres client per connection string per isolate. Workers middleware runs
 * per request; building a fresh pool each time leaks sockets into Hyperdrive and
 * stalls under load. Reuse is safe: postgres.js pools are lazy between queries
 * and Hyperdrive multiplexes the upstream connections.
 */
const clientCache = new Map<string, PostgresJsDatabase>()

function cachedDb(connectionString: string): PostgresJsDatabase {
  const hit = clientCache.get(connectionString)
  if (hit) return hit
  const sql = postgres(connectionString, { max: 5 })
  const db = drizzle(sql)
  clientCache.set(connectionString, db)
  return db
}

export function catalogDb(env: ApiEnv): PostgresJsDatabase {
  return cachedDb(env.HYPERDRIVE.connectionString)
}

export function primaryDb(env: ApiEnv): PostgresJsDatabase {
  return cachedDb(env.HYPERDRIVE_PRIMARY.connectionString)
}
