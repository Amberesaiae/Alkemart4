import { resolveMarket } from "@alkemart/shared/markets"

/** Server-side money for emails/SMS — market-driven, no hard-coded currency. */
export function formatMinorForEmail(minor: bigint | number, currency: string, marketCode?: string) {
  const m = resolveMarket(marketCode)
  const major = Number(minor) / m.minorUnitsPerMajor
  const symbol = currency.toUpperCase() === "GHS" ? "GH₵" : null
  try {
    const s = new Intl.NumberFormat(m.defaultLocale, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: 2 }).format(major)
    return symbol ? s.replace(/GHS\s?|GH₵\s?/, symbol) : s
  } catch {
    return `${currency.toUpperCase()} ${major.toFixed(2)}`
  }
}
