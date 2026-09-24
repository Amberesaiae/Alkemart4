/**
 * Pure migration planning (no I/O, no driver). Tested without a database;
 * `migrate.ts` executes the plan.
 */
export const MIGRATIONS_TABLE = "schema_migrations"

export function isMigrationFile(name: string): boolean {
  return name.endsWith(".sql")
}

/** Which files still need applying, in order. */
export function pendingMigrations(appliedVersions: readonly string[], files: readonly string[]): string[] {
  const applied = new Set(appliedVersions)
  return files
    .filter((f) => isMigrationFile(f))
    .map((f) => f.replace(/\.sql$/, ""))
    .filter((v) => !applied.has(v))
    .sort()
}
