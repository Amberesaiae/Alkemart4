/**
 * Storefront market config — the one place a country is named.
 *
 * AGNOSTIC-PRODUCTION-PLAN C7: Ghana is the first market, not the only one.
 * UI components read currency, phone, address, regions, payment methods and
 * mobile-money networks from here via `useMarket()`; none of them name a
 * country, currency symbol or dialling code.
 *
 * Today the market table is data in this file (sourced from
 * `@alkemart/shared`). When `/store/markets` ships, `loadMarkets()` becomes an
 * API call and nothing else changes.
 */
import {
  GHANA_REGIONS,
  GHS,
  detectMomoProvider,
  displayRegionName,
  nearestRegionByCoords,
} from "@alkemart/shared/ghana"
import { resolveMarket } from "@alkemart/shared/markets"
import type { MomoProvider, PaymentMethod } from "./checkout"

export type AddressFieldKey = "address_1" | "address_2" | "city" | "province" | "postal_code"

export type AddressField = {
  key: AddressFieldKey
  label: string
  required: boolean
  placeholder?: string
  /** `select` renders `options` (e.g. regions). */
  input?: "text" | "select"
  options?: { value: string; label: string }[]
}

export type MobileMoneyNetwork = {
  id: MomoProvider
  name: string
  /** Public asset path. */
  logo: string
  /** Buyer-facing number prefixes, e.g. "024 · 054 · 055". */
  prefixes: string
}

export type StorefrontMarket = {
  /** Market code, e.g. "GH" — matches `@alkemart/shared/markets`. */
  code: string
  /** Lowercase ISO-3166 alpha-2 sent as `country_code` at checkout. */
  countryCode: string
  name: string
  currency: {
    /** ISO-4217, e.g. "GHS". */
    code: string
    /** Display symbol, e.g. "GH₵". */
    symbol: string
    /** BCP-47 locale for number formatting. */
    locale: string
    minorUnitsPerMajor: number
  }
  phone: {
    callingCode: string
    example: string
    hint: string
  }
  /** Delivery areas buyers can browse by (first-level admin regions). */
  regions: { id: string; name: string }[]
  regionLabel: string
  majorCities: string[]
  address: { fields: AddressField[]; help: string }
  paymentMethods: PaymentMethod[]
  mobileMoney: MobileMoneyNetwork[]
  detectMobileMoney: (phone: string) => MomoProvider | null
  /** Bounding box: a pin outside it is a bad GPS read, not a location. */
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
  /** Stored region (code or name) → buyer-facing region name. */
  regionName: (stored: string | null | undefined) => string | null
  /** Coordinates → region, for "use my location". Null outside the market. */
  nearestRegion: (lat: number, lng: number) => { name: string } | null
  deliveryHint: string
}

const GHANA: StorefrontMarket = {
  code: "GH",
  countryCode: "gh",
  name: "Ghana",
  currency: {
    code: GHS.code,
    symbol: GHS.symbol,
    locale: GHS.locale,
    minorUnitsPerMajor: resolveMarket("GH").minorUnitsPerMajor,
  },
  phone: { callingCode: "+233", example: "024 123 4567", hint: "Mobile number for the rider" },
  regions: GHANA_REGIONS.map((r) => ({ id: r.id, name: r.name })),
  regionLabel: "Region",
  majorCities: ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast", "Tema"],
  address: {
    fields: [
      { key: "address_1", label: "Street / area", required: true, placeholder: "Ring Road, East Legon" },
      { key: "address_2", label: "Landmark", required: false, placeholder: "Opposite the filling station" },
      { key: "city", label: "City / town", required: true, placeholder: "Accra" },
      {
        key: "province",
        label: "Region",
        required: true,
        input: "select",
        options: GHANA_REGIONS.map((r) => ({ value: r.name, label: r.name })),
      },
      { key: "postal_code", label: "GhanaPostGPS (optional)", required: false, placeholder: "GA-123-4567" },
    ],
    help: "Riders call before arriving — a landmark helps them find you.",
  },
  paymentMethods: ["cod", "momo", "card"],
  mobileMoney: [
    { id: "mtn", name: "MTN MoMo", logo: "/momo/mtn.png", prefixes: "024 · 054 · 055 · 059" },
    { id: "vodafone", name: "Telecel Cash", logo: "/momo/telecel.png", prefixes: "020 · 050" },
    { id: "airteltigo", name: "AT Money", logo: "/momo/airteltigo.png", prefixes: "026 · 027 · 056 · 057" },
  ],
  detectMobileMoney: (phone) => detectMomoProvider(phone),
  bounds: { minLat: 4.0, maxLat: 11.8, minLng: -3.8, maxLng: 1.8 },
  regionName: (stored) => displayRegionName(stored),
  nearestRegion: (lat, lng) => nearestRegionByCoords(lat, lng),
  deliveryHint: "Each seller quotes their own delivery fee — shown before you pay.",
}

const MARKETS: Record<string, StorefrontMarket> = { GH: GHANA }

/** Build-time default; admin-controlled once `/store/markets` exists. */
function defaultMarketCode(): string {
  const raw = (import.meta.env.VITE_MARKET_CODE as string | undefined)?.trim().toUpperCase()
  return raw && MARKETS[raw] ? raw : "GH"
}

let active: StorefrontMarket = MARKETS[defaultMarketCode()]!

/** The market this storefront is serving. Sync, for non-React modules. */
export function getActiveMarket(): StorefrontMarket {
  return active
}

/** Test/bootstrap hook: switch the active market by code. */
export function setActiveMarket(code: string): StorefrontMarket {
  const next = MARKETS[code.toUpperCase()]
  if (!next) throw new Error(`Unknown market ${code}`)
  active = next
  return active
}

export function inMarket(lat: number, lng: number, m: StorefrontMarket = getActiveMarket()): boolean {
  const b = m.bounds
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng
}

export function listMarkets(): StorefrontMarket[] {
  return Object.values(MARKETS)
}

/**
 * Format a major-unit amount. The currency comes from the API row when
 * present (cart/order currency), else the active market — never a literal.
 */
export function formatMoney(
  amount: number | null | undefined,
  currencyCode?: string | null,
  opts?: { compact?: boolean },
): string {
  if (amount == null || !Number.isFinite(amount)) return "—"
  const m = getActiveMarket()
  const code = (currencyCode || m.currency.code).toUpperCase()
  const whole = Number.isInteger(amount)
  try {
    const parts = new Intl.NumberFormat(m.currency.locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: opts?.compact && whole ? 0 : 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount)
    // Prefer the market's familiar symbol (GH₵) over Intl's (GHS / GH₵ varies by engine).
    return parts
      .map((p) =>
        p.type === "currency" && code === m.currency.code ? m.currency.symbol : p.value,
      )
      .join("")
      .replace(/^(\D+)\s*/, "$1 ")
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

/**
 * React access to the active market. Static today; becomes the provider's
 * value once markets load from the API.
 */
export function useMarket(): StorefrontMarket {
  return getActiveMarket()
}
