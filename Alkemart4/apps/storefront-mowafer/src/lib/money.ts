import { getMarketCurrency, getMarketLocale } from "@/design/market"

/**
 * Currency-agnostic money helpers. Amounts are major units (cedis, dollars…).
 * Currency always threads from the API; the market default is only a
 * last-resort fallback so no component hardcodes GHS/GH₵.
 */

export function normalizeCurrencyCode(raw: string | null | undefined): string {
  const code = (raw ?? "").trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      new Intl.NumberFormat(getMarketLocale(), { style: "currency", currency: code })
      return code
    } catch {
      /* fall through to market default */
    }
  }
  return getMarketCurrency()
}

export function formatMoney(
  amount: number | null | undefined,
  currencyCode?: string | null,
  locale?: string,
): string {
  if (amount == null || !Number.isFinite(amount)) return "—"
  const code = normalizeCurrencyCode(currencyCode)
  try {
    return new Intl.NumberFormat(locale ?? getMarketLocale(), {
      style: "currency",
      currency: code,
    }).format(amount)
  } catch {
    return `${code} ${amount}`
  }
}

export function currencySymbol(currencyCode?: string | null, locale?: string): string {
  const code = normalizeCurrencyCode(currencyCode)
  try {
    const parts = new Intl.NumberFormat(locale ?? getMarketLocale(), {
      style: "currency",
      currency: code,
    }).formatToParts(0)
    return parts.find((p) => p.type === "currency")?.value ?? code
  } catch {
    return code
  }
}

export function formatPriceRange(
  min: number,
  max: number,
  currencyCode?: string | null,
  locale?: string,
): string {
  const sym = currencySymbol(currencyCode, locale)
  return `${sym}${min} – ${sym}${max}`
}
