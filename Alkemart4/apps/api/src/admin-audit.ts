import { adminActions } from "@alkemart/db"
import { desc, eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type AdminActionInput = {
  adminUserId: string
  action: string
  targetType: string
  targetId: string
  detail?: Record<string, unknown>
}

export type AdminActionRow = AdminActionInput & { id: string; createdAt: Date }

export interface AdminAuditLog {
  log(input: AdminActionInput): Promise<void>
  list(filter?: { targetType?: string; targetId?: string; limit?: number }): Promise<AdminActionRow[]>
}

export class PostgresAdminAuditLog implements AdminAuditLog {
  constructor(private readonly db: PostgresJsDatabase) {}

  async log(input: AdminActionInput): Promise<void> {
    // Audit writes are best-effort: they must never break the business write.
    try {
      await this.db.insert(adminActions).values({
        id: crypto.randomUUID(),
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        detail: input.detail ?? null,
      })
    } catch (err) {
      console.warn(`[audit] failed to log ${input.action}: ${err instanceof Error ? err.message : err}`)
    }
  }

  async list(filter: { targetType?: string; targetId?: string; limit?: number } = {}): Promise<AdminActionRow[]> {
    const rows = await this.db
      .select()
      .from(adminActions)
      .orderBy(desc(adminActions.createdAt))
      .limit(Math.max(1, Math.min(filter.limit ?? 50, 200)))
    return rows
      .filter(
        (r) =>
          (!filter.targetType || r.targetType === filter.targetType) &&
          (!filter.targetId || r.targetId === filter.targetId),
      )
      .map((r) => ({
        id: r.id,
        adminUserId: r.adminUserId,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        detail: (r.detail ?? undefined) as Record<string, unknown> | undefined,
        createdAt: r.createdAt,
      }))
  }
}

export class InMemoryAdminAuditLog implements AdminAuditLog {
  readonly rows: AdminActionRow[] = []

  async log(input: AdminActionInput): Promise<void> {
    this.rows.push({ ...input, id: `audit-${this.rows.length + 1}`, createdAt: new Date() })
  }

  async list(filter: { targetType?: string; targetId?: string; limit?: number } = {}): Promise<AdminActionRow[]> {
    return this.rows
      .filter(
        (r) =>
          (!filter.targetType || r.targetType === filter.targetType) &&
          (!filter.targetId || r.targetId === filter.targetId),
      )
      .slice(-(Math.max(1, Math.min(filter.limit ?? 50, 200))))
      .reverse()
  }
}
