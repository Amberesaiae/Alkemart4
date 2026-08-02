/**
 * Ghana locale constants — re-exports from @alkemart/shared/ghana (single source of truth).
 *
 * The rich Region objects with id/capital/iso/lat/lon live in packages/shared/src/ghana/regions.ts.
 * This file exposes the flat string-list variants that operating-markets.ts and seller-setup need.
 * Any new code should import from @alkemart/shared/ghana directly.
 */
import {
  GHANA_REGIONS_LIST,
  GHANA_MAJOR_CITIES,
  type Region,
} from "@alkemart/shared/ghana"

export { Region }

/**
 * Flat list of the 16 administrative region names — for address dropdowns.
 * Source of truth: packages/shared/src/ghana/regions.ts → GHANA_REGIONS_LIST
 */
export const GHANA_REGIONS: readonly string[] = GHANA_REGIONS_LIST

export { GHANA_MAJOR_CITIES }

/**
 * Fixed constants for Ghana market onboarding copy.
 * Kept here (not in shared) because they include internal defaults only
 * relevant to the backend seed/setup scripts.
 */
export const GHANA = {
  countryCode: "gh",
  countryName: "Ghana",
  currencyCode: "ghs",
  currencySymbol: "GH₵",
  phoneCountryCode: "+233",
  phoneExample: "024 123 4567",
  phoneHint: "Mobile (024…)",
  postalLabel: "GhanaPostGPS (optional)",
  postalExample: "GA-184-1234",
  postalHint: "Optional digital address",
  regionLabel: "Region",
  cityLabel: "City / town",
  addressLabel: "Street / house / area",
  landmarkLabel: "Landmark (optional)",
  landmarkExample: "Near Goil, blue gate…",
  defaultCity: "Accra",
  defaultRegion: "Greater Accra",
  defaultAddressLine: "Spintex Road",
} as const

export function isGhanaCountry(code: string | null | undefined): boolean {
  return (code || "").trim().toLowerCase() === "gh"
}
