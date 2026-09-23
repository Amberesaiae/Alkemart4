import { vendorImports } from "@alkemart/db"
import { and, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Blueprint Phase 4E — import idempotency ledger. The client-supplied key
 * is unique per seller: replaying a key returns the stored per-row summary
 * without creating anything again.
 */

export type ImportRowOutcome = {
  row: number
  ok: boolean
  errors: string[]
  productId: string | null
}

export type ImportBatchDto = {
  id: string
  sellerId: string
  importKey: string
  rowCount: number
  createdCount: number
  rows: ImportRowOutcome[]
  createdAt: string
}

export interface ImportBatchStore {
  findBatch(sellerId: string, importKey: string): Promise<ImportBatchDto | null>
  recordBatch(
    sellerId: string,
    importKey: string,
    rows: ImportRowOutcome[],
  ): Promise<ImportBatchDto>
}

function toDto(
  row: typeof vendorImports.$inferSelect,
  rows: ImportRowOutcome[],
): ImportBatchDto {
  return {
    id: row.id,
    sellerId: row.sellerId,
    importKey: row.importKey,
    rowCount: row.rowCount,
    createdCount: row.createdCount,
    rows,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date(0).toISOString(),
  }
}

function readRows(summary: unknown): ImportRowOutcome[] {
  if (!Array.isArray(summary)) return []
  return summary.filter(
    (r): r is ImportRowOutcome =>
      !!r && typeof r === "object" && typeof (r as { row?: unknown }).row === "number",
  )
}

export class InMemoryImportBatchStore implements ImportBatchStore {
  private readonly batches = new Map<string, ImportBatchDto>()

  async findBatch(sellerId: string, importKey: string): Promise<ImportBatchDto | null> {
    return this.batches.get(`${sellerId}\n${importKey}`) ?? null
  }

  async recordBatch(
    sellerId: string,
    importKey: string,
    rows: ImportRowOutcome[],
  ): Promise<ImportBatchDto> {
    const batch: ImportBatchDto = {
      id: crypto.randomUUID(),
      sellerId,
      importKey,
      rowCount: rows.length,
      createdCount: rows.filter((r) => r.ok).length,
      rows: rows.map((r) => ({ ...r })),
      createdAt: new Date().toISOString(),
    }
    this.batches.set(`${sellerId}\n${importKey}`, batch)
    return batch
  }
}

export class PostgresImportBatchStore implements ImportBatchStore {
  constructor(private readonly db: PostgresJsDatabase) {}

  async findBatch(sellerId: string, importKey: string): Promise<ImportBatchDto | null> {
    const [row] = await this.db
      .select()
      .from(vendorImports)
      .where(and(eq(vendorImports.sellerId, sellerId), eq(vendorImports.importKey, importKey)))
      .limit(1)
    if (!row) return null
    return toDto(row, readRows(row.summary))
  }

  async recordBatch(
    sellerId: string,
    importKey: string,
    rows: ImportRowOutcome[],
  ): Promise<ImportBatchDto> {
    const id = crypto.randomUUID()
    try {
      const [row] = await this.db
        .insert(vendorImports)
        .values({
          id,
          sellerId,
          importKey,
          rowCount: rows.length,
          createdCount: rows.filter((r) => r.ok).length,
          success: rows.length > 0 && rows.every((r) => r.ok) ? 1 : 0,
          summary: rows,
        })
        .returning()
      if (!row) throw new Error("import batch insert failed")
      return toDto(row, readRows(row.summary))
    } catch (err) {
      // Concurrent double-submit: the unique (seller, key) row already
      // landed — answer the replay instead of duplicating.
      const existing = await this.findBatch(sellerId, importKey).catch(() => null)
      if (existing) return existing
      throw new Error(
        "import store unavailable - POST /admin/migrate/blueprint-phase4",
        { cause: err },
      )
    }
  }
}
