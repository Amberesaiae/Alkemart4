/**
 * Ghana market constants and utilities for the vendor dashboard.
 *
 * All geographic, phone, and payment constants come from @alkemart/shared/ghana
 * (packages/shared/src/ghana/). Do not duplicate them here.
 *
 * This file only exports:
 *   1. Re-exports from @alkemart/shared/ghana for convenience
 *   2. Vendor-specific display metadata (MOMO_NETWORKS) that is UI-only
 */

// ---------------------------------------------------------------------------
// Regions — single source of truth in packages/shared/src/ghana/regions.ts
// ---------------------------------------------------------------------------
import {
  GHANA_REGIONS_LIST,
  GHANA_MAJOR_CITIES,
  type Region,
} from "@alkemart/shared/ghana"

export { Region }
export { GHANA_MAJOR_CITIES }

/** Flat list of 16 administrative region names for dropdowns. */
export const GHANA_REGIONS = GHANA_REGIONS_LIST
export type GhanaRegion = (typeof GHANA_REGIONS)[number]

// ---------------------------------------------------------------------------
// Mobile Money providers
// PaystackMomoProvider = "mtn" | "vodafone" | "airteltigo" (Paystack API slugs)
// ---------------------------------------------------------------------------
import { type PaystackMomoProvider } from "@alkemart/shared/ghana"

export type { PaystackMomoProvider }
/** Alias for backward compatibility within vendor dashboard code. */
export type MomoProvider = PaystackMomoProvider

/**
 * Display metadata for each provider.
 * NCA prefixes are UX-only hints (Paystack is the real validator).
 */
export const MOMO_NETWORKS: Record<
  MomoProvider,
  { label: string; prefixes: string[] }
> = {
  mtn: {
    label: "MTN Mobile Money",
    prefixes: ["024", "054", "055", "059"],
  },
  vodafone: {
    label: "Telecel Cash",
    prefixes: ["020", "050"],
  },
  airteltigo: {
    label: "AirtelTigo Money",
    prefixes: ["026", "027", "056", "057"],
  },
}

// ---------------------------------------------------------------------------
// Phone helpers
// ---------------------------------------------------------------------------
import { formatPhone } from "@alkemart/shared/ghana"
export { formatPhone }
export { detectMobileOperator, MOBILE_PREFIXES } from "@alkemart/shared/ghana"

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------
export { GHS, formatGHS, pesewasToMajor, majorToPesewas } from "@alkemart/shared/ghana"

// ---------------------------------------------------------------------------
// UI copy — Ghana-specific placeholders and labels for forms
// ---------------------------------------------------------------------------
export const GHANA_UI = {
  addressPlaceholder: "e.g. 12 Oxford Street, Osu",
  landmarkPlaceholder: "e.g. Near Danquah Circle",
  cityPlaceholder: "e.g. Accra",
  postalLabel: "Digital Address (GhanaPost GPS)",
  postalExample: "e.g. GA-183-8164",
  phoneExample: "e.g. 024 123 4567",
} as const

// ---------------------------------------------------------------------------
// Phone helpers (vendor UI) — mirror backend normalizePhoneForCountry("gh", …)
// ---------------------------------------------------------------------------

/** Local 9-digit NSN (e.g. "241234567") or null if not derivable. */
function localNsn(phone: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("233") && digits.length === 12) return digits.slice(3)
  if (digits.startsWith("0") && digits.length === 10) return digits.slice(1)
  if (digits.length === 9) return digits
  return null
}

/** NCA prefix in local form, e.g. "024", or null. */
function localPrefix(phone: string): string | null {
  const nsn = localNsn(phone)
  return nsn ? `0${nsn.slice(0, 2)}` : null
}

/**
 * Normalize a Ghana mobile number to E.164 (+233XXXXXXXXX).
 * Matches backend normalizePhoneForCountry("gh", …). Returns the trimmed
 * input unchanged if it cannot be normalized (backend will reject it).
 */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  const nsn = localNsn(trimmed)
  if (nsn) return `+233${nsn}`
  // Fallbacks accepted by the backend: overlong 233… or any +international
  const digits = trimmed.replace(/\D/g, "")
  if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`
  return trimmed
}

/**
 * Validate a Ghana mobile number for Mobile Money.
 * Returns an error message, or null when the number is valid.
 */
export function validatePhone(phone: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed) return "Phone number is required"
  const prefix = localPrefix(trimmed)
  if (!prefix) return "Enter a valid mobile number (024 123 4567 or +233 24 123 4567)"
  const known = Object.values(MOMO_NETWORKS).some((net) => net.prefixes.includes(prefix))
  if (!known) return "This prefix is not a supported Mobile Money network (MTN, Telecel, AirtelTigo)"
  return null
}

/** Pretty display form: "+233 024 123 4567" style via shared formatter. */
export function formatPhoneDisplay(phone: string): string {
  return formatPhone(phone)
}

/** Detect the MoMo provider from the number's NCA prefix, or null. */
export function detectProvider(phone: string): MomoProvider | null {
  const prefix = localPrefix(phone)
  if (!prefix) return null
  for (const [provider, net] of Object.entries(MOMO_NETWORKS) as [
    MomoProvider,
    { label: string; prefixes: string[] },
  ][]) {
    if (net.prefixes.includes(prefix)) return provider
  }
  return null
}

/** Human-readable prefix hint for a provider, e.g. "024, 054, 055, 059". */
export function prefixHint(provider: MomoProvider): string {
  return MOMO_NETWORKS[provider].prefixes.join(", ")
}
