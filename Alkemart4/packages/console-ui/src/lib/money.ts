/**
 * Money display for the consoles. Market-agnostic: currency and locale come
 * from `@alkemart/shared/markets` via the app's market code; nothing here
 * names a country. Display only — ledger maths stays in integer minor units
 * on the server.
 */
import { resolveMarket } from "@alkemart/shared/markets"

/** Familiar symbols where Intl output varies by engine (GHS vs GH₵). */
const SYMBOL: Record<string, string> = { GHS: "GH₵" }

let marketCode: string | undefined

/** Call once at app start with `import.meta.env.VITE_MARKET_CODE`. */
export function setConsoleMarket(code: string | undefined) {
  marketCode = code
}

export function consoleMarket() {
  return resolveMarket(marketCode)
}

function format(major: number, currency: string, compact: boolean) {
  const m = consoleMarket()
  const code = currency.toUpperCase()
  const whole = Number.isInteger(major)
  try {
    return new Intl.NumberFormat(m.defaultLocale, {
      style: "currency",
      currency: code,
      notation: compact && Math.abs(major) >= 100_000 ? "compact" : "standard",
      minimumFractionDigits: compact && whole ? 0 : 2,
      maximumFractionDigits: 2,
    })
      .formatToParts(major)
      .map((p) => (p.type === "currency" && SYMBOL[code] ? SYMBOL[code] : p.value))
      .join("")
  } catch {
    return `${code} ${major.toFixed(2)}`
  }
}

/** Minor units (pesewas, kobo, cents…) → display string. */
export function formatMinor(minor: number | bigint | string | null | undefined, currency?: string, opts?: { compact?: boolean }) {
  if (minor == null || minor === "") return "—"
  const m = consoleMarket()
  const n = Number(minor)
  if (!Number.isFinite(n)) return "—"
  return format(n / m.minorUnitsPerMajor, currency ?? m.currencyCode, opts?.compact ?? false)
}

/** Already-major amounts (some admin stats endpoints return majors). */
export function formatMajor(major: number | null | undefined, currency?: string, opts?: { compact?: boolean }) {
  if (major == null || !Number.isFinite(major)) return "—"
  return format(major, currency ?? consoleMarket().currencyCode, opts?.compact ?? false)
}

/** "3 hours ago", "2 days ago" — for queue ages and order waits. */
export function timeAgo(iso: string | Date | null | undefined, now: Date = new Date()) {
  if (!iso) return "—"
  const t = typeof iso === "string" ? new Date(iso) : iso
  const s = Math.round((now.getTime() - t.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(consoleMarket().defaultLocale, { numeric: "auto" })
  if (Math.abs(s) < 60) return rtf.format(-s, "second")
  if (Math.abs(s) < 3600) return rtf.format(-Math.round(s / 60), "minute")
  if (Math.abs(s) < 86_400) return rtf.format(-Math.round(s / 3600), "hour")
  return rtf.format(-Math.round(s / 86_400), "day")
}

/** The market's familiar currency symbol (e.g. "GH₵"). */
export function currencySymbol(currency?: string) {
  const code = (currency ?? consoleMarket().currencyCode).toUpperCase()
  return SYMBOL[code] ?? code
}

/**
 * What a seller typed ("150", "150.5", "1,250.00") → minor units as a
 * string for the API, or null when it isn't a positive amount. Integer
 * maths on the digits — no float rounding on money.
 */
/** Major-unit text → minor units. Zero is refused unless `allowZero` (e.g. free delivery). */
export function parseMajorToMinor(text: string, { allowZero = false } = {}): string | null {
  const t = text.replace(/[,\s]/g, "").trim()
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null
  const per = consoleMarket().minorUnitsPerMajor
  const decimals = Math.round(Math.log10(per))
  const [whole, frac = ""] = t.split(".")
  const minor = BigInt(whole!) * BigInt(per) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")
  return minor > 0n || (allowZero && minor === 0n) ? minor.toString() : null
}

/** Minor units → the plain number a seller edits ("150.50"). */
export function minorToMajorText(minor: number | string | null | undefined) {
  if (minor == null || minor === "") return ""
  const per = consoleMarket().minorUnitsPerMajor
  const n = Number(minor) / per
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.round(Math.log10(per)))
}
