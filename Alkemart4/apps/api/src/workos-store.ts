import { workosAttempts, workosIdentities, workosSessions } from "@alkemart/db"
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { AuthConflictError, PostgresAuthRepository, type AuthRepository, type AuthUser } from "./auth-repository"

export type WorkosActor = "store" | "vendor"
export type WorkosAttempt = typeof workosAttempts.$inferInsert
export type WorkosSession = typeof workosSessions.$inferSelect
export type WorkosProvision = {
  clientId: string; subject: string; email: string; actor: WorkosActor
  link?: { userId: string; passwordVersion: string }
  shop?: { name: string; handle: string }
}
export class WorkosAccountError extends Error {
  constructor(readonly code: "account_link_required" | "account_link_invalid" | "vendor_membership_required" | "account_restricted") {
    super(code)
  }
}
export const passwordVersion = (user: AuthUser) => String(user.passwordChangedAt?.getTime() ?? 0)
// A crashed refresh must not strand a browser forever or retry a possibly
// consumed provider credential. A stale claim revokes the local session.
const staleRefresh = (lock: string | null) => !!lock && (!/^\d+:/.test(lock) || Date.now() - Number(lock.split(":")[0]) > 30_000)

export interface WorkosStore {
  saveAttempt(attempt: WorkosAttempt): Promise<void>
  consumeAttempt(stateHash: string, browserHash: string): Promise<WorkosAttempt | null>
  provision(input: WorkosProvision): Promise<AuthUser>
  saveSession(session: WorkosSession): Promise<void>
  getSession(id: string): Promise<WorkosSession | null>
  claimRefresh(id: string, secretHash: string, lockId: string): Promise<WorkosSession | null>
  rotateSession(id: string, lockId: string, encryptedRefresh: string): Promise<boolean>
  revokeSession(id: string): Promise<void>
}

async function provision(repo: AuthRepository, input: WorkosProvision, mappedId: string | null) {
  const email = input.email.trim().toLowerCase()
  let user = mappedId ? await repo.findUserById(mappedId) : null
  if (mappedId && !user) throw new WorkosAccountError("account_restricted")
  if (input.link) {
    const old = await repo.findUserById(input.link.userId)
    if (!old || old.email !== email || passwordVersion(old) !== input.link.passwordVersion || old.role === "admin"
      || (mappedId && mappedId !== old.id)) throw new WorkosAccountError("account_link_invalid")
    user = old
  }
  if (!user) {
    // WorkOS only returns verified emails (Google-verified, or a code sent to that
    // inbox), the same proof our email reset gives. So an existing account with
    // this email is the person's own: sign them into it (orders, shop and all).
    // Admin accounts are never reached this way.
    const existing = await repo.findUserByEmail(email)
    if (existing?.role === "admin") throw new WorkosAccountError("account_restricted")
    if (existing) user = existing
  }
  if (!user) {
    // A provider-only account cannot authenticate via any local password endpoint.
    const credentials = { id: crypto.randomUUID(), email, passwordHash: "!workos-only" }
    if (input.actor === "vendor") {
      if (!input.shop) throw new WorkosAccountError("vendor_membership_required")
      user = (await repo.registerVendor({ user: credentials, seller: { id: crypto.randomUUID(), name: input.shop.name, handle: input.shop.handle } })).user
    } else user = await repo.createUser({ ...credentials, role: "buyer" })
  }
  if (user.role === "admin" || user.email !== email) throw new WorkosAccountError("account_restricted")
  if (input.actor === "vendor") {
    if (!await repo.findSellerMemberByUserId(user.id)) {
      if (!input.shop) throw new WorkosAccountError("vendor_membership_required")
      user = await repo.openShopForUser(user.id, { id: crypto.randomUUID(), name: input.shop.name, handle: input.shop.handle })
    }
  }
  return repo.markEmailVerified(user.id)
}

export class InMemoryWorkosStore implements WorkosStore {
  private attempts = new Map<string, WorkosAttempt>()
  private identities = new Map<string, string>()
  private sessions = new Map<string, WorkosSession>()
  constructor(private repo: AuthRepository) {}
  async saveAttempt(a: WorkosAttempt) {
    for (const [k, v] of this.attempts) if (v.expiresAt.getTime() <= Date.now()) this.attempts.delete(k)
    this.attempts.set(a.stateHash, { ...a })
  }
  async consumeAttempt(hash: string, browserHash: string) {
    const row = this.attempts.get(hash)
    if (!row || row.browserHash !== browserHash || row.expiresAt.getTime() <= Date.now()) return null
    this.attempts.delete(hash)
    return { ...row }
  }
  async provision(input: WorkosProvision) {
    const key = `${input.clientId}:${input.subject}`
    const id = this.identities.get(key) ?? null
    const user = await provision(this.repo, input, id)
    for (const [k, v] of this.identities) {
      if (k !== key && k.startsWith(`${input.clientId}:`) && v === user.id) throw new WorkosAccountError("account_link_invalid")
    }
    this.identities.set(key, user.id)
    return user
  }
  async saveSession(s: WorkosSession) { this.sessions.set(s.id, { ...s }) }
  async getSession(id: string) {
    const s = this.sessions.get(id)
    if (s && staleRefresh(s.lockId)) { await this.revokeSession(id); return null }
    if (!s || s.revokedAt || s.expiresAt.getTime() <= Date.now() || s.idleExpiresAt.getTime() <= Date.now()) return null
    return { ...s }
  }
  async claimRefresh(id: string, secretHash: string, lockId: string) {
    const s = await this.getSession(id)
    if (!s || s.lockId || s.secretHash !== secretHash) return null
    const actual = this.sessions.get(id)!
    // No await between inspection and update of the underlying row.
    if (actual.lockId || actual.revokedAt) return null
    actual.lockId = lockId
    return { ...actual }
  }
  async rotateSession(id: string, lockId: string, encryptedRefresh: string) {
    const s = this.sessions.get(id)
    if (!s || s.lockId !== lockId || s.revokedAt || s.expiresAt.getTime() <= Date.now()) return false
    Object.assign(s, { encryptedRefresh, lockId: null, idleExpiresAt: new Date(Date.now() + 86400_000) })
    return true
  }
  async revokeSession(id: string) { const s = this.sessions.get(id); if (s) s.revokedAt = new Date() }
}

export class PostgresWorkosStore implements WorkosStore {
  constructor(private db: PostgresJsDatabase) {}
  async saveAttempt(a: WorkosAttempt) {
    // /start is public: sweep abandoned attempts as new ones arrive (indexed on expiry).
    await this.db.delete(workosAttempts).where(lt(workosAttempts.expiresAt, new Date()))
    await this.db.insert(workosAttempts).values(a)
  }
  async consumeAttempt(hash: string, browserHash: string) {
    const [row] = await this.db.delete(workosAttempts).where(and(eq(workosAttempts.stateHash, hash), eq(workosAttempts.browserHash, browserHash), gt(workosAttempts.expiresAt, new Date()))).returning()
    return row ?? null
  }
  async provision(input: WorkosProvision) {
    try {
      return await this.db.transaction(async (tx) => {
        // Serialize identity and email provisioning; unique constraints remain the final guard.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.email.trim().toLowerCase()}, 0))`)
        const [mapping] = await tx.select().from(workosIdentities).where(and(eq(workosIdentities.clientId, input.clientId), eq(workosIdentities.subject, input.subject)))
        const user = await provision(new PostgresAuthRepository(tx), input, mapping?.userId ?? null)
        if (!mapping) await tx.insert(workosIdentities).values({ clientId: input.clientId, subject: input.subject, userId: user.id })
        return user
      })
    } catch (error) {
      if (error instanceof AuthConflictError || (error as { code?: string }).code === "23505"
        || (error as { cause?: { code?: string } }).cause?.code === "23505") throw new WorkosAccountError("account_link_invalid")
      throw error
    }
  }
  async saveSession(s: WorkosSession) { await this.db.insert(workosSessions).values(s) }
  async getSession(id: string) {
    const [s] = await this.db.select().from(workosSessions).where(and(eq(workosSessions.id, id), isNull(workosSessions.revokedAt), gt(workosSessions.expiresAt, new Date()), gt(workosSessions.idleExpiresAt, new Date())))
    if (s && staleRefresh(s.lockId)) { await this.revokeSession(id); return null }
    return s ?? null
  }
  async claimRefresh(id: string, secretHash: string, lockId: string) {
    const [s] = await this.db.update(workosSessions).set({ lockId }).where(and(eq(workosSessions.id, id), eq(workosSessions.secretHash, secretHash), isNull(workosSessions.lockId), isNull(workosSessions.revokedAt), gt(workosSessions.expiresAt, new Date()), gt(workosSessions.idleExpiresAt, new Date()))).returning()
    return s ?? null
  }
  async rotateSession(id: string, lockId: string, encryptedRefresh: string) {
    const rows = await this.db.update(workosSessions).set({ encryptedRefresh, lockId: null, idleExpiresAt: new Date(Date.now() + 86400_000) }).where(and(eq(workosSessions.id, id), eq(workosSessions.lockId, lockId), isNull(workosSessions.revokedAt), gt(workosSessions.expiresAt, new Date()))).returning({ id: workosSessions.id })
    return rows.length === 1
  }
  async revokeSession(id: string) { await this.db.update(workosSessions).set({ revokedAt: new Date() }).where(eq(workosSessions.id, id)) }
}
