import { compareWallets, comparisons } from "@alkemart/db"
import { spendToken, walletNow, type CompareTokenPolicy, type CompareWallet } from "@alkemart/domain"
import { eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type ComparisonRow = { id: string; userId: string; productIds: string[]; createdAt: Date }

/**
 * ⚖ compare tokens and saved comparisons (0048). The wallet is topped up
 * lazily (domain `walletNow`) whenever it is read or spent, so there is no
 * refill job. Spending is atomic: a token and its comparison are one step.
 */
export interface CompareStore {
  wallet(userId: string, now: Date, policy: CompareTokenPolicy): Promise<CompareWallet>
  /** Spend one token and save the comparison. Throws CompareRuleError at zero. */
  open(userId: string, productIds: string[], now: Date, policy: CompareTokenPolicy): Promise<{ wallet: CompareWallet; comparison: ComparisonRow }>
  get(id: string): Promise<ComparisonRow | null>
}

export class InMemoryCompareStore implements CompareStore {
  private wallets = new Map<string, CompareWallet>()
  private saved = new Map<string, ComparisonRow>()

  async wallet(userId: string, now: Date, policy: CompareTokenPolicy) {
    const w = walletNow(this.wallets.get(userId) ?? null, now, policy)
    this.wallets.set(userId, w)
    return { ...w }
  }

  async open(userId: string, productIds: string[], now: Date, policy: CompareTokenPolicy) {
    const w = spendToken(walletNow(this.wallets.get(userId) ?? null, now, policy), policy)
    this.wallets.set(userId, w)
    const comparison: ComparisonRow = { id: crypto.randomUUID(), userId, productIds: [...productIds], createdAt: now }
    this.saved.set(comparison.id, comparison)
    return { wallet: { ...w }, comparison }
  }

  async get(id: string) {
    const c = this.saved.get(id)
    return c ? { ...c, productIds: [...c.productIds] } : null
  }
}

export class PostgresCompareStore implements CompareStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  private async save(tx: PostgresJsDatabase, userId: string, w: CompareWallet) {
    await tx
      .insert(compareWallets)
      .values({ userId, balance: w.balance, refilledAt: w.refilledAt })
      .onConflictDoUpdate({ target: compareWallets.userId, set: { balance: w.balance, refilledAt: w.refilledAt, updatedAt: sql`now()` } })
  }

  async wallet(userId: string, now: Date, policy: CompareTokenPolicy) {
    const [row] = await this.db.select().from(compareWallets).where(eq(compareWallets.userId, userId)).limit(1)
    const w = walletNow(row ? { balance: row.balance, refilledAt: row.refilledAt } : null, now, policy)
    if (!row || row.balance !== w.balance || row.refilledAt.getTime() !== w.refilledAt.getTime()) await this.save(this.db, userId, w)
    return w
  }

  async open(userId: string, productIds: string[], now: Date, policy: CompareTokenPolicy) {
    return this.db.transaction(async (tx) => {
      // Lock the wallet row so two taps can't spend the same token.
      await tx.execute(sql`INSERT INTO compare_wallets (user_id, balance, refilled_at) VALUES (${userId}, ${policy.grant}, ${now}) ON CONFLICT (user_id) DO NOTHING`)
      const [row] = await tx.select().from(compareWallets).where(eq(compareWallets.userId, userId)).for("update").limit(1)
      const w = spendToken(walletNow(row ? { balance: row.balance, refilledAt: row.refilledAt } : null, now, policy), policy)
      await this.save(tx as unknown as PostgresJsDatabase, userId, w)
      const comparison: ComparisonRow = { id: crypto.randomUUID(), userId, productIds: [...productIds], createdAt: now }
      await tx.insert(comparisons).values(comparison)
      return { wallet: w, comparison }
    })
  }

  async get(id: string) {
    const [row] = await this.db.select().from(comparisons).where(eq(comparisons.id, id)).limit(1)
    return row ? { id: row.id, userId: row.userId, productIds: row.productIds, createdAt: row.createdAt } : null
  }
}
