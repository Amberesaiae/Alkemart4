import { shopPolicyVersions } from "@alkemart/db"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type ShopPolicyBody = {
  shipping?: string
  returnsDays?: number
  warranty?: string
}

export type ShopPolicyRow = {
  id: string
  sellerId: string
  version: number
  body: ShopPolicyBody
  effectiveFrom: Date
}

export interface ShopPolicyStore {
  /** Append a new version; version is assigned sequentially per seller. */
  savePolicy(sellerId: string, body: ShopPolicyBody): Promise<ShopPolicyRow>
  currentPolicy(sellerId: string): Promise<ShopPolicyRow | null>
  listPolicies(sellerId: string): Promise<ShopPolicyRow[]>
}

function toRow(r: typeof shopPolicyVersions.$inferSelect): ShopPolicyRow {
  return {
    id: r.id,
    sellerId: r.sellerId,
    version: r.version,
    body: (r.body ?? {}) as ShopPolicyBody,
    effectiveFrom: r.effectiveFrom,
  }
}

export class PostgresShopPolicyStore implements ShopPolicyStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async savePolicy(sellerId: string, body: ShopPolicyBody): Promise<ShopPolicyRow> {
    const existing = await this.db
      .select({ version: shopPolicyVersions.version })
      .from(shopPolicyVersions)
      .where(eq(shopPolicyVersions.sellerId, sellerId))
      .orderBy(desc(shopPolicyVersions.version))
      .limit(1)
    const version = (existing[0]?.version ?? 0) + 1
    const [row] = await this.db
      .insert(shopPolicyVersions)
      .values({ id: crypto.randomUUID(), sellerId, version, body })
      .returning()
    if (!row) throw new Error("failed to save policy")
    return toRow(row)
  }

  async currentPolicy(sellerId: string): Promise<ShopPolicyRow | null> {
    const [row] = await this.db
      .select()
      .from(shopPolicyVersions)
      .where(eq(shopPolicyVersions.sellerId, sellerId))
      .orderBy(desc(shopPolicyVersions.version))
      .limit(1)
    return row ? toRow(row) : null
  }

  async listPolicies(sellerId: string): Promise<ShopPolicyRow[]> {
    const rows = await this.db
      .select()
      .from(shopPolicyVersions)
      .where(eq(shopPolicyVersions.sellerId, sellerId))
      .orderBy(desc(shopPolicyVersions.version))
    return rows.map(toRow)
  }
}

export class InMemoryShopPolicyStore implements ShopPolicyStore {
  private n = 0;
  readonly rows: ShopPolicyRow[] = []

  async savePolicy(sellerId: string, body: ShopPolicyBody): Promise<ShopPolicyRow> {
    const version = this.rows.filter((r) => r.sellerId === sellerId).length + 1
    const row: ShopPolicyRow = {
      id: `policy-${++this.n}`,
      sellerId,
      version,
      body,
      effectiveFrom: new Date(),
    }
    this.rows.push(row)
    return row
  }

  async currentPolicy(sellerId: string): Promise<ShopPolicyRow | null> {
    const mine = this.rows.filter((r) => r.sellerId === sellerId)
    return mine.length > 0 ? mine[mine.length - 1]! : null
  }

  async listPolicies(sellerId: string): Promise<ShopPolicyRow[]> {
    return this.rows.filter((r) => r.sellerId === sellerId).reverse()
  }
}
