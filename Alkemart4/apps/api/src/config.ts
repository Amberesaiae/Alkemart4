/**
 * API-local tunables (agnostic plan §1.5: infra names and thresholds live in
 * ONE config module, read from env with validated defaults — never literals
 * scattered in handlers).
 */
function numEnv(name: string, fallback: number): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[name]
  const parsed = raw === undefined || raw === "" ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? (parsed as number) : fallback
}

export const SEARCH_CONFIG = {
  /** Trigram similarity floor (PG docs default 0.3). Applied per-tx via SET LOCAL. */
  trgmThreshold: numEnv("SEARCH_TRGM_THRESHOLD", 0.3),
  /** Safety cap on ranked candidates; hit = warn log, never silent. */
  trgmMaxCandidates: Math.max(1, Math.trunc(numEnv("SEARCH_TRGM_MAX_CANDIDATES", 500))),
} as const
