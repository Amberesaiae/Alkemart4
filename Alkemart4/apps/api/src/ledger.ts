import { DEFAULT_MARKET_CODE } from "@alkemart/shared/markets"
import { asMoney, feeFor } from "@alkemart/domain"
import { ledgerEntries } from "@alkemart/db"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { eq } from "drizzle-orm"

/**
 * Append-only money ledger (agnostic plan Phase 4). Every movement is a row
 * written in the SAME transaction as the state change it records; disputes
 * are answered with SELECT. Kinds are an open vocabulary (new PSPs/markets
 * add kinds, never columns).
 */
export const LEDGER_KINDS = ["sale", "platform_fee", "payout", "refund", "adjustment"] as const
export type LedgerKind = (typeof LEDGER_KINDS)[number]

export type LedgerEntryInput = {
  idempotencyKey: string
  marketCode?: string
  sellerId: string
  orderId?: string | null
  intentId?: string | null
  kind: LedgerKind
  amountMinor: bigint
  currency: string
}

export type LedgerEntry = {
  idempotencyKey: string
  marketCode: string
  sellerId: string
  orderId: string | null
  intentId: string | null
  kind: LedgerKind
  amountMinor: bigint
  currency: string
}

export function saleEntries(
  input: { orderId: string; intentId: string; sellerId: string; subtotalMinor: bigint; currency: string; commissionBps: number; marketCode?: string },
): [LedgerEntryInput, LedgerEntryInput] {
  const fee = feeFor(asMoney(input.subtotalMinor, input.currency), input.commissionBps)
  const marketCode = input.marketCode ?? DEFAULT_MARKET_CODE
  return [
    {
      idempotencyKey: `sale:${input.orderId}`,
      marketCode,
      sellerId: input.sellerId,
      orderId: input.orderId,
      intentId: input.intentId,
      kind: "sale",
      amountMinor: input.subtotalMinor,
      currency: input.currency,
    },
    {
      idempotencyKey: `platform_fee:${input.orderId}`,
      marketCode,
      sellerId: input.sellerId,
      orderId: input.orderId,
      intentId: input.intentId,
      kind: "platform_fee",
      amountMinor: fee.amountMinor,
      currency: input.currency,
    },
  ]
}

export function payoutEntry(input: {
  payoutId: string
  sellerId: string
  netMinor: bigint
  currency: string
  marketCode?: string
}): LedgerEntryInput {
  return {
    idempotencyKey: `payout:${input.payoutId}`,
    marketCode: input.marketCode ?? DEFAULT_MARKET_CODE,
    sellerId: input.sellerId,
    orderId: null,
    intentId: null,
    kind: "payout",
    amountMinor: input.netMinor,
    currency: input.currency,
  }
}

export interface LedgerStore {
  /** Idempotent append: returns inserted=false when the key already exists. */
  append(entry: LedgerEntryInput): Promise<{ inserted: boolean }>
  listForOrder(orderId: string): Promise<LedgerEntry[]>
  listForSeller(sellerId: string, limit?: number): Promise<LedgerEntry[]>
}

function toEntry(row: {
  idempotencyKey: string
  marketCode: string
  sellerId: string
  orderId: string | null
  intentId: string | null
  kind: string
  amountMinor: bigint
  currency: string
}): LedgerEntry {
  return { ...row, kind: row.kind as LedgerKind }
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly rows = new Map<string, LedgerEntry>()

  async append(entry: LedgerEntryInput): Promise<{ inserted: boolean }> {
    if (this.rows.has(entry.idempotencyKey)) return { inserted: false }
    this.rows.set(entry.idempotencyKey, {
      idempotencyKey: entry.idempotencyKey,
      marketCode: entry.marketCode ?? DEFAULT_MARKET_CODE,
      sellerId: entry.sellerId,
      orderId: entry.orderId ?? null,
      intentId: entry.intentId ?? null,
      kind: entry.kind,
      amountMinor: entry.amountMinor,
      currency: entry.currency,
    })
    return { inserted: true }
  }

  async listForOrder(orderId: string): Promise<LedgerEntry[]> {
    return [...this.rows.values()].filter((r) => r.orderId === orderId)
  }

  async listForSeller(sellerId: string, limit = 50): Promise<LedgerEntry[]> {
    return [...this.rows.values()].filter((r) => r.sellerId === sellerId).slice(0, limit)
  }
}

type DbOrTx = PostgresJsDatabase | Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0]

export class PostgresLedgerStore implements LedgerStore {
  constructor(private readonly db: DbOrTx) {}

  async append(entry: LedgerEntryInput): Promise<{ inserted: boolean }> {
    const rows = await (this.db as PostgresJsDatabase)
      .insert(ledgerEntries)
      .values({
        id: crypto.randomUUID(),
        idempotencyKey: entry.idempotencyKey,
        marketCode: entry.marketCode ?? DEFAULT_MARKET_CODE,
        sellerId: entry.sellerId,
        orderId: entry.orderId ?? null,
        intentId: entry.intentId ?? null,
        kind: entry.kind,
        amountMinor: entry.amountMinor,
        currency: entry.currency,
      })
      .onConflictDoNothing({ target: ledgerEntries.idempotencyKey })
      .returning({ key: ledgerEntries.idempotencyKey })
    return { inserted: rows.length > 0 }
  }

  async listForOrder(orderId: string): Promise<LedgerEntry[]> {
    const rows = await (this.db as PostgresJsDatabase)
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, orderId))
    return rows.map(toEntry)
  }

  async listForSeller(sellerId: string, limit = 50): Promise<LedgerEntry[]> {
    const rows = await (this.db as PostgresJsDatabase)
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.sellerId, sellerId))
      .limit(Math.max(1, Math.min(limit, 200)))
    return rows.map(toEntry)
  }
}
