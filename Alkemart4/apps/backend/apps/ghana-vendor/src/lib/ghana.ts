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
export { formatPhone, detectMobileOperator, MOBILE_PREFIXES } from "@alkemart/shared/ghana"

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------
export { GHS, formatGHS, pesewasToMajor, majorToPesewas } from "@alkemart/shared/ghana"
