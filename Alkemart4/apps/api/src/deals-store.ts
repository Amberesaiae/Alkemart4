import { offerNegotiation, priceOffers } from "@alkemart/db"
import type { DealStatus } from "@alkemart/domain"
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type NegotiationRow = { offerId: string; sellerId: string; negotiable: boolean; floorPesewas: bigint | null }

export type DealRow = {
  id: string
  offerId: string
  productId: string
  sellerId: string
  buyerUserId: string
  buyerName: string | null
  qty: number
  listPricePesewas: bigint
  amountPesewas: bigint
  counterPesewas: bigint | null
  agreedPesewas: bigint | null
  status: DealStatus
  respondBy: Date | null
  validUntil: Date | null
  usedIntentId: string | null
  timeline: { at: string; by: string; note: string }[]
  createdAt: Date
  updatedAt: Date
}

export type DealChange = {
  status: DealStatus
  respondBy: Date | null
  counterPesewas?: bigint | null
  agreedPesewas?: bigint | null
  validUntil?: Date | null
  usedIntentId?: string | null
  entry: { by: string; note: string }
}

/**
 * Make an offer (0046): negotiation settings per listing and the offers
 * themselves. Steps are compare-and-swap on status, so two taps (or a tap
 * racing the deadline sweep) can't both win.
 */
export interface DealsStore {
  getNegotiation(offerIds: string[]): Promise<Map<string, NegotiationRow>>
  setNegotiation(row: NegotiationRow): Promise<NegotiationRow>
  createDeal(d: Omit<DealRow, "id" | "createdAt" | "updatedAt" | "timeline" | "counterPesewas" | "agreedPesewas" | "validUntil" | "usedIntentId"> & { entry: { by: string; note: string } }): Promise<DealRow>
  getDeal(id: string): Promise<DealRow | null>
  listDeals(f: { buyerUserId?: string; sellerId?: string; statuses?: DealStatus[]; dueAt?: Date; offerId?: string }): Promise<DealRow[]>
  advanceDeal(id: string, from: DealStatus, change: DealChange): Promise<DealRow | null>
}

export class InMemoryDealsStore implements DealsStore {
  private neg = new Map<string, NegotiationRow>()
  private deals = new Map<string, DealRow>()
  now: () => Date = () => new Date()

  async getNegotiation(offerIds: string[]) {
    return new Map(offerIds.flatMap((id) => (this.neg.has(id) ? [[id, { ...this.neg.get(id)! }] as const] : [])))
  }
  async setNegotiation(row: NegotiationRow) {
    this.neg.set(row.offerId, { ...row })
    return { ...row }
  }
  async createDeal(d: Parameters<DealsStore["createDeal"]>[0]) {
    const now = this.now()
    const { entry, ...rest } = d
    const row: DealRow = { ...rest, id: crypto.randomUUID(), counterPesewas: null, agreedPesewas: null, validUntil: null, usedIntentId: null, timeline: [{ at: now.toISOString(), ...entry }], createdAt: now, updatedAt: now }
    this.deals.set(row.id, row)
    return structuredClone(row)
  }
  async getDeal(id: string) {
    const d = this.deals.get(id)
    return d ? structuredClone(d) : null
  }
  async listDeals(f: { buyerUserId?: string; sellerId?: string; statuses?: DealStatus[]; dueAt?: Date; offerId?: string }) {
    return [...this.deals.values()]
      .filter((d) => (!f.buyerUserId || d.buyerUserId === f.buyerUserId) && (!f.sellerId || d.sellerId === f.sellerId) && (!f.offerId || d.offerId === f.offerId))
      .filter((d) => (!f.statuses || f.statuses.includes(d.status)) && (!f.dueAt || (!!d.respondBy && d.respondBy.getTime() <= f.dueAt.getTime())))
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .map((d) => structuredClone(d))
  }
  async advanceDeal(id: string, from: DealStatus, change: DealChange) {
    const d = this.deals.get(id)
    if (!d || d.status !== from) return null
    const now = this.now()
    d.status = change.status
    d.respondBy = change.respondBy
    if (change.counterPesewas !== undefined) d.counterPesewas = change.counterPesewas
    if (change.agreedPesewas !== undefined) d.agreedPesewas = change.agreedPesewas
    if (change.validUntil !== undefined) d.validUntil = change.validUntil
    if (change.usedIntentId !== undefined) d.usedIntentId = change.usedIntentId
    d.timeline.push({ at: now.toISOString(), ...change.entry })
    d.updatedAt = now
    return structuredClone(d)
  }
}

const toDeal = (r: typeof priceOffers.$inferSelect): DealRow => ({ ...r, status: r.status as DealStatus })

export class PostgresDealsStore implements DealsStore {
  constructor(private readonly db: PostgresJsDatabase) {}
  async getNegotiation(offerIds: string[]) {
    if (!offerIds.length) return new Map<string, NegotiationRow>()
    const rows = await this.db.select().from(offerNegotiation).where(inArray(offerNegotiation.offerId, offerIds))
    return new Map(rows.map((r) => [r.offerId, { offerId: r.offerId, sellerId: r.sellerId, negotiable: r.negotiable, floorPesewas: r.floorPesewas }]))
  }
  async setNegotiation(row: NegotiationRow) {
    await this.db
      .insert(offerNegotiation)
      .values({ ...row, updatedAt: new Date() })
      .onConflictDoUpdate({ target: offerNegotiation.offerId, set: { negotiable: row.negotiable, floorPesewas: row.floorPesewas, updatedAt: new Date() } })
    return row
  }
  async createDeal(d: Parameters<DealsStore["createDeal"]>[0]) {
    const { entry, ...rest } = d
    const [r] = await this.db
      .insert(priceOffers)
      .values({ ...rest, id: crypto.randomUUID(), timeline: [{ at: new Date().toISOString(), ...entry }] })
      .returning()
    if (!r) throw new Error("offer not saved")
    return toDeal(r)
  }
  async getDeal(id: string) {
    const [r] = await this.db.select().from(priceOffers).where(eq(priceOffers.id, id)).limit(1)
    return r ? toDeal(r) : null
  }
  async listDeals(f: { buyerUserId?: string; sellerId?: string; statuses?: DealStatus[]; dueAt?: Date; offerId?: string }) {
    const where = [
      f.buyerUserId ? eq(priceOffers.buyerUserId, f.buyerUserId) : undefined,
      f.sellerId ? eq(priceOffers.sellerId, f.sellerId) : undefined,
      f.offerId ? eq(priceOffers.offerId, f.offerId) : undefined,
      f.statuses ? (f.statuses.length ? inArray(priceOffers.status, f.statuses) : sql`false`) : undefined,
      f.dueAt ? lte(priceOffers.respondBy, f.dueAt) : undefined,
    ].filter(Boolean)
    const rows = await this.db.select().from(priceOffers).where(where.length ? and(...where) : undefined).orderBy(desc(priceOffers.createdAt)).limit(300)
    return rows.map(toDeal)
  }
  async advanceDeal(id: string, from: DealStatus, change: DealChange) {
    const entry = { at: new Date().toISOString(), ...change.entry }
    const [r] = await this.db
      .update(priceOffers)
      .set({
        status: change.status,
        respondBy: change.respondBy,
        updatedAt: new Date(),
        timeline: sql`${priceOffers.timeline} || ${JSON.stringify([entry])}::jsonb`,
        ...(change.counterPesewas !== undefined ? { counterPesewas: change.counterPesewas } : {}),
        ...(change.agreedPesewas !== undefined ? { agreedPesewas: change.agreedPesewas } : {}),
        ...(change.validUntil !== undefined ? { validUntil: change.validUntil } : {}),
        ...(change.usedIntentId !== undefined ? { usedIntentId: change.usedIntentId } : {}),
      })
      .where(and(eq(priceOffers.id, id), eq(priceOffers.status, from)))
      .returning()
    return r ? toDeal(r) : null
  }
}
