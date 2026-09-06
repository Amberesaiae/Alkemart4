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
