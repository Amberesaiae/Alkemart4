import { moderationAppeals } from "@alkemart/db"
import { and, desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type AppealStatus = "open" | "closed"
export type AppealDecision = "reopened" | "upheld"

export type AppealRow = {
  id: string
  productId: string
  sellerId: string
  message: string
  status: AppealStatus
  decision: AppealDecision | null
  response: string | null
  createdAt: Date
}

export interface AppealStore {
  openAppeal(input: { productId: string; sellerId: string; message: string }): Promise<AppealRow>
  openAppealForProduct(productId: string): Promise<AppealRow | null>
  listBySeller(sellerId: string): Promise<AppealRow[]>
  listOpen(): Promise<AppealRow[]>
  resolve(id: string, decision: AppealDecision, response: string | null): Promise<AppealRow | null>
}

function toRow(r: typeof moderationAppeals.$inferSelect): AppealRow {
  return {
    id: r.id,
    productId: r.productId,
    sellerId: r.sellerId,
    message: r.message,
    status: r.status as AppealStatus,
    decision: (r.decision ?? null) as AppealDecision | null,
    response: r.response,
    createdAt: r.createdAt,
  }
}

export class PostgresAppealStore implements AppealStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async openAppeal(input: { productId: string; sellerId: string; message: string }): Promise<AppealRow> {
    const [row] = await this.db
      .insert(moderationAppeals)
      .values({ id: crypto.randomUUID(), ...input })
      .returning()
    if (!row) throw new Error("failed to open appeal")
    return toRow(row)
  }

  async openAppealForProduct(productId: string): Promise<AppealRow | null> {
    const [row] = await this.db
      .select()
      .from(moderationAppeals)
      .where(and(eq(moderationAppeals.productId, productId), eq(moderationAppeals.status, "open")))
      .limit(1)
    return row ? toRow(row) : null
  }

  async listBySeller(sellerId: string): Promise<AppealRow[]> {
    const rows = await this.db
      .select()
      .from(moderationAppeals)
      .where(eq(moderationAppeals.sellerId, sellerId))
      .orderBy(desc(moderationAppeals.createdAt))
    return rows.map(toRow)
  }

  async listOpen(): Promise<AppealRow[]> {
    const rows = await this.db
      .select()
      .from(moderationAppeals)
      .where(eq(moderationAppeals.status, "open"))
      .orderBy(desc(moderationAppeals.createdAt))
    return rows.map(toRow)
  }

  async resolve(id: string, decision: AppealDecision, response: string | null): Promise<AppealRow | null> {
    const [row] = await this.db
      .update(moderationAppeals)
      .set({ status: "closed", decision, response, respondedAt: new Date() })
      .where(and(eq(moderationAppeals.id, id), eq(moderationAppeals.status, "open")))
      .returning()
    return row ? toRow(row) : null
  }
}

export class InMemoryAppealStore implements AppealStore {
  private n = 0;
  readonly rows: AppealRow[] = []

  async openAppeal(input: { productId: string; sellerId: string; message: string }): Promise<AppealRow> {
    const row: AppealRow = { ...input, id: `appeal-${++this.n}`, status: "open", decision: null, response: null, createdAt: new Date() }
    this.rows.push(row)
    return row
  }

  async openAppealForProduct(productId: string): Promise<AppealRow | null> {
    return this.rows.find((r) => r.productId === productId && r.status === "open") ?? null
  }

  async listBySeller(sellerId: string): Promise<AppealRow[]> {
    return this.rows.filter((r) => r.sellerId === sellerId)
  }

  async listOpen(): Promise<AppealRow[]> {
    return this.rows.filter((r) => r.status === "open")
  }

  async resolve(id: string, decision: AppealDecision, response: string | null): Promise<AppealRow | null> {
    const row = this.rows.find((r) => r.id === id && r.status === "open")
    if (!row) return null
    row.status = "closed"
    row.decision = decision
    row.response = response
    return row
  }
}
