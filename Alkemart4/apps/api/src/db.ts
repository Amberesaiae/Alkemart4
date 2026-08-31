import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import type { ApiEnv } from "./env"

export function catalogDb(env: ApiEnv) {
  const sql = postgres(env.HYPERDRIVE.connectionString, { max: 5 })
  return drizzle(sql)
}

export function primaryDb(env: ApiEnv) {
  const sql = postgres(env.HYPERDRIVE_PRIMARY.connectionString, { max: 5 })
  return drizzle(sql)
}
