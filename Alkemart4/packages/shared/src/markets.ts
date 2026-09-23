/**
 * Market configuration (agnostic plan Phase 4). Ghana is the first ROW in
 * this table, not a branch in the code: currency, locale, and commercial
 * defaults resolve from `market_code`. Browser-safe (no env access) — the
 * server selects the market per request; UI passes it explicitly.
 */
export type MarketConfig = {
  /** Stable code, e.g. `GH`. Stored on ledger rows. */
  code: string
  /** ISO-4217 uppercase, e.g. `GHS`. */
  currencyCode: string
  minorUnitsPerMajor: number
  defaultCommissionBps: number
  defaultLocale: string
}

export const MARKETS: Record<string, MarketConfig> = {
  GH: {
    code: "GH",
    currencyCode: "GHS",
    minorUnitsPerMajor: 100,
    defaultCommissionBps: 700,
    defaultLocale: "en-GH",
  },
}

export const DEFAULT_MARKET_CODE = "GH"

export function resolveMarket(code?: string | null): MarketConfig {
  if (code) {
    const found = MARKETS[code.toUpperCase()]
    if (found) return found
  }
  return MARKETS[DEFAULT_MARKET_CODE] as MarketConfig
}

/** Single source for "which currency are we writing?" — never a literal. */
export function marketCurrency(code?: string | null): string {
  return resolveMarket(code).currencyCode
}
