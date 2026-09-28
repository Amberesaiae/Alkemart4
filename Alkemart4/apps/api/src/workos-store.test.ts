import migration from "../../../packages/db/src/migrations/0051_workos_auth.sql?raw"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { PostgresWorkosStore, type WorkosSession } from "./workos-store"

describe("WorkOS migration and PostgreSQL session operations", () => {
  let db: PGlite
  let store: PostgresWorkosStore
  beforeAll(async () => {
    // Isolated embedded PostgreSQL: never uses a configured production URL.
    db = new PGlite()
    await db.exec("CREATE TABLE users (id text PRIMARY KEY); INSERT INTO users VALUES ('buyer');")
    await db.exec(migration)
    await db.exec(migration) // Re-run is required by the repository migration convention.
    store = new PostgresWorkosStore(drizzle(db) as unknown as PostgresJsDatabase)
  }, 30_000)
  afterAll(async () => { await db?.close() })
  function session(id: string, overrides: Partial<WorkosSession> = {}): WorkosSession {
    return { id, userId: "buyer", subject: "user_provider", clientId: "client_test", actor: "store", secretHash: "secret-hash", encryptedRefresh: "encrypted-only", passwordVersion: "0", expiresAt: new Date(Date.now() + 3600_000), idleExpiresAt: new Date(Date.now() + 3600_000), lockId: null, revokedAt: null, createdAt: new Date(), ...overrides }
  }
  it("consumes a browser-bound state exactly once, including concurrent callbacks", async () => {
    await store.saveAttempt({ stateHash: "state", browserHash: "browser", encryptedData: "ciphertext", expiresAt: new Date(Date.now() + 60_000) })
    expect(await store.consumeAttempt("state", "attacker")).toBeNull()
    const results = await Promise.all([store.consumeAttempt("state", "browser"), store.consumeAttempt("state", "browser")])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
  it("uses one refresh claimant and compare-and-swap rotation", async () => {
    await store.saveSession(session("atomic"))
    const lockA = `${Date.now()}:a`, lockB = `${Date.now()}:b`
    const claims = await Promise.all([store.claimRefresh("atomic", "secret-hash", lockA), store.claimRefresh("atomic", "secret-hash", lockB)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    const winner = claims.find(Boolean)!.lockId!
    expect(await store.rotateSession("atomic", "wrong-lock", "new")).toBe(false)
    expect(await store.rotateSession("atomic", winner, "new-encrypted")).toBe(true)
    expect((await store.getSession("atomic"))?.encryptedRefresh).toBe("new-encrypted")
    await store.revokeSession("atomic")
    expect(await store.getSession("atomic")).toBeNull()
    expect(await store.rotateSession("atomic", winner, "replayed")).toBe(false)
  })
  it("fails closed on expired sessions and interrupted refreshes", async () => {
    await store.saveSession(session("expired", { expiresAt: new Date(Date.now() - 1000) }))
    await store.saveSession(session("interrupted", { lockId: `${Date.now() - 31_000}:crashed` }))
    expect(await store.getSession("expired")).toBeNull()
    expect(await store.getSession("interrupted")).toBeNull()
    expect(await store.claimRefresh("interrupted", "secret-hash", `${Date.now()}:retry`)).toBeNull()
  })
  it("enforces identity uniqueness and RLS at the database boundary", async () => {
    await db.exec("INSERT INTO workos_identities (client_id, subject, user_id) VALUES ('client', 'subject', 'buyer')")
    await expect(db.exec("INSERT INTO workos_identities (client_id, subject, user_id) VALUES ('client', 'other', 'buyer')")).rejects.toThrow()
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>("SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('workos_sessions', 'workos_attempts', 'workos_identities')")
    expect(result.rows).toHaveLength(3)
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true)
  })
})
