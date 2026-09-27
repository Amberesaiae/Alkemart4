import { platformSettings } from "@alkemart/db"
import { eq } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

/**
 * Admin-tunable platform rules (`platform_settings`, key → JSON). Defaults and
 * validation live in `packages/domain`; this only stores what admin changed.
 * Apps never hard-code these numbers — they read results from the API.
 */
export interface SettingsStore {
  get(key: string): Promise<unknown | null>
  set(key: string, value: unknown, by: string): Promise<void>
}

export class InMemorySettingsStore implements SettingsStore {
  private rows = new Map<string, unknown>()
  async get(key: string) {
    return this.rows.has(key) ? structuredClone(this.rows.get(key)) : null
  }
  async set(key: string, value: unknown) {
    this.rows.set(key, structuredClone(value))
  }
}

export class PostgresSettingsStore implements SettingsStore {
  constructor(private readonly db: PostgresJsDatabase) {}
  async get(key: string) {
    const [row] = await this.db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1)
    return row?.value ?? null
  }
  async set(key: string, value: unknown, by: string) {
    await this.db
      .insert(platformSettings)
      .values({ key, value, updatedBy: by })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: by, updatedAt: new Date() } })
  }
}
