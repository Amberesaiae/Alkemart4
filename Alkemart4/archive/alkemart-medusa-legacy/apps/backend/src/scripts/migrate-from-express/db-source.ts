/**
 * Express Neon source connection for ETL (migrate-from-express).
 *
 * Uses EXPRESS_DATABASE_URL when set; falls back to DATABASE_URL for local
 * transitional setups where Express and Medusa share a host/DB (not recommended
 * for production cutover — see docs/architecture/2026-07-15-neon-database-layout.md).
 *
 * Never log the full connection string (credentials).
 */

import pg from "pg"

export type ExpressQueryFn = <T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<T[]>

function getExpressDatabaseUrl(): string {
  const url =
    process.env.EXPRESS_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      "EXPRESS_DATABASE_URL (or DATABASE_URL fallback) is required for Express ETL source"
    )
  }
  return url
}

/** Host + path only — safe for logs. */
export function redactedDbTarget(connectionString?: string): string {
  const raw = connectionString ?? getExpressDatabaseUrl()
  try {
    const u = new URL(raw)
    const db = u.pathname || "/"
    return `${u.protocol}//${u.hostname}${db}`
  } catch {
    return "(unparseable-connection-string)"
  }
}

function buildClientConfig(connectionString: string): pg.ClientConfig {
  const needsSsl =
    /neon\.tech/i.test(connectionString) ||
    /sslmode=require/i.test(connectionString) ||
    /sslmode=verify/i.test(connectionString)

  return {
    connectionString,
    // Neon serverless TLS; rejectUnauthorized false is standard for Neon pooler
    // when CA chain is not bundled in the runtime.
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  }
}

/**
 * Open a short-lived Client, run `fn`, always disconnect.
 */
export async function withExpressDb<T>(
  fn: (client: pg.Client) => Promise<T>
): Promise<T> {
  const connectionString = getExpressDatabaseUrl()
  const client = new pg.Client(buildClientConfig(connectionString))
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end().catch(() => {
      // ignore disconnect errors
    })
  }
}

/**
 * One-shot typed query against Express Neon.
 */
export async function queryExpress<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  return withExpressDb(async (client) => {
    const result = await client.query<T>(text, params)
    return result.rows
  })
}

/**
 * Bind a client for multiple queries in one connection (preferred for multi-table reads).
 */
export function createExpressQuery(client: pg.Client): ExpressQueryFn {
  return async <T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => {
    const result = await client.query<T>(text, params)
    return result.rows
  }
}
