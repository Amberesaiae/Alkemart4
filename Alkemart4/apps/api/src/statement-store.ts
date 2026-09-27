import { statements } from "@alkemart/db"
import type { StatementData, StatementScope } from "@alkemart/domain"
import { and, desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type StoredStatement = { scope: StatementScope; sellerId: string | null; period: string; data: StatementData; hash: string; closedAt: Date }

/**
 * Frozen monthly statements. `close` writes once; a second close of the same
 * month returns what was first written — never a rewrite.
 */
export interface StatementStore {
  get(scope: StatementScope, sellerId: string | null, period: string): Promise<StoredStatement | null>
  close(s: Omit<StoredStatement, "closedAt">): Promise<StoredStatement>
  list(scope: StatementScope, sellerId: string | null): Promise<Omit<StoredStatement, "data">[]>
}

const key = (scope: StatementScope, sellerId: string | null, period: string) => `${scope}|${sellerId ?? ""}|${period}`

export class InMemoryStatementStore implements StatementStore {
  private rows = new Map<string, StoredStatement>()
  async get(scope: StatementScope, sellerId: string | null, period: string) {
    const r = this.rows.get(key(scope, sellerId, period))
    return r ? structuredClone(r) : null
  }
  async close(s: Omit<StoredStatement, "closedAt">) {
    const k = key(s.scope, s.sellerId, s.period)
    if (!this.rows.has(k)) this.rows.set(k, { ...structuredClone(s), closedAt: new Date() })
    return structuredClone(this.rows.get(k)!)
  }
  async list(scope: StatementScope, sellerId: string | null) {
    return [...this.rows.values()]
      .filter((r) => r.scope === scope && (r.sellerId ?? null) === (sellerId ?? null))
      .sort((a, b) => b.period.localeCompare(a.period))
      .map(({ data: _d, ...rest }) => rest)
  }
}

export class PostgresStatementStore implements StatementStore {
  constructor(private readonly db: PostgresJsDatabase) {}
  private toStored(r: typeof statements.$inferSelect): StoredStatement {
    return { scope: r.scope, sellerId: r.sellerId || null, period: r.period, data: r.data as StatementData, hash: r.hash, closedAt: r.closedAt }
  }
  async get(scope: StatementScope, sellerId: string | null, period: string) {
    const [r] = await this.db
      .select()
      .from(statements)
      .where(and(eq(statements.scope, scope), eq(statements.sellerId, sellerId ?? ""), eq(statements.period, period)))
      .limit(1)
    return r ? this.toStored(r) : null
  }
  async close(s: Omit<StoredStatement, "closedAt">) {
    await this.db
      .insert(statements)
      .values({ id: crypto.randomUUID(), scope: s.scope, sellerId: s.sellerId ?? "", period: s.period, data: s.data, hash: s.hash })
      .onConflictDoNothing()
    const stored = await this.get(s.scope, s.sellerId, s.period)
    if (!stored) throw new Error("statement not stored")
    return stored
  }
  async list(scope: StatementScope, sellerId: string | null) {
    const rows = await this.db
      .select({ scope: statements.scope, sellerId: statements.sellerId, period: statements.period, hash: statements.hash, closedAt: statements.closedAt })
      .from(statements)
      .where(and(eq(statements.scope, scope), eq(statements.sellerId, sellerId ?? "")))
      .orderBy(desc(statements.period))
    return rows.map((r) => ({ ...r, sellerId: r.sellerId || null }))
  }
}
