/**
 * Market-agnostic config for the lab storefront.
 * Defaults are Ghana (GHS / en-GH) via env overrides — no hardcoded
 * country strings in components; read from here instead.
 */

export type MarketConfig = {
  country: string
  currency: string
  locale: string
}

function env(name: string): string | undefined {
  const raw = (import.meta.env[name] as string | undefined)?.trim()
  return raw ? raw : undefined
}

export function getMarket(): MarketConfig {
  return {
    country: env("VITE_MARKET_COUNTRY") ?? "Ghana",
    currency: (env("VITE_MARKET_CURRENCY") ?? "GHS").toUpperCase(),
    locale: env("VITE_MARKET_LOCALE") ?? "en-GH",
  }
}

export function getMarketCountry(): string {
  return getMarket().country
}

export function getMarketCurrency(): string {
  return getMarket().currency
}

export function getMarketLocale(): string {
  return getMarket().locale
}
