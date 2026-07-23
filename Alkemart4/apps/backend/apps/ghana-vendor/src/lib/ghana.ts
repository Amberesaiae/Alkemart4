/**
 * Ghana market constants and utilities — frontend mirror of backend core modules.
 *
 * Sources (do not invent values here — always derive from backend):
 *   - Regions:     packages/api/src/lib/ghana-locale.ts  → GHANA_REGIONS
 *   - Phone norm:  packages/api/src/lib/operating-markets.ts → normalizePhoneForCountry("gh", …)
 *   - Provider IDs: packages/api/src/lib/paystack-client.ts → MomoProvider
 *   - Labels/hints: packages/api/src/lib/ghana-locale.ts → GHANA object
 *   - NCA prefixes: not in backend (Paystack validates); kept here as UX-only hint.
 */

// ---------------------------------------------------------------------------
// Regions — exact copy of packages/api/src/lib/ghana-locale.ts GHANA_REGIONS
// (plain strings, same order, same spelling — backend source of truth)
// ---------------------------------------------------------------------------

export const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
] as const

export type GhanaRegion = (typeof GHANA_REGIONS)[number]

// ---------------------------------------------------------------------------
// Mobile Money providers
// Exact type from packages/api/src/lib/paystack-client.ts → MomoProvider
// Paystack internal slugs: mtn→"mtn", vodafone→"vod", airteltigo→"atl"
// ---------------------------------------------------------------------------

export type MomoProvider = "mtn" | "vodafone" | "airteltigo"

/**
 * Display metadata for each provider.
 * NCA prefixes are UX-only hints (Paystack is the real validator).
 * Prefix source: NCA Ghana numbering plan, current as of 2024.
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
    label: "Telecel Cash",          // rebranded from Vodafone Ghana
    prefixes: ["020", "050"],
  },
  airteltigo: {
    label: "AT Money (AirtelTigo)",
    prefixes: ["026", "027", "056", "057"],
  },
}

// Flat prefix → provider map, built once
const PREFIX_TO_PROVIDER: Record<string, MomoProvider> = {}
for (const [provider, meta] of Object.entries(MOMO_NETWORKS) as [MomoProvider, { prefixes: string[] }][]) {
  for (const prefix of meta.prefixes) {
    PREFIX_TO_PROVIDER[prefix] = provider
  }
}

// ---------------------------------------------------------------------------
// Phone utilities — normalisation mirrors backend normalizePhoneForCountry("gh", …)
// packages/api/src/lib/operating-markets.ts
// ---------------------------------------------------------------------------

/**
 * Normalise a raw Ghana phone string to E.164 (+233XXXXXXXXX).
 * Mirrors backend normalizePhoneForCountry("gh", phone) exactly.
 * Throws with the same error message as the backend on bad input.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error("Phone is required")
  const digits = trimmed.replace(/\D/g, "")

  if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`
  if (digits.length === 9) return `+233${digits}`
  if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`
  throw new Error("Enter a valid mobile (024… or +233…)")
}

// ---------------------------------------------------------------------------
// UX helpers (not in backend — purely for form feedback)
// ---------------------------------------------------------------------------

/**
 * Detect provider from a partially entered Ghana number.
 * Returns null when the number is too short or prefix is unknown.
 * Paystack is the authoritative validator; this is display-only.
 */
export function detectProvider(raw: string): MomoProvider | null {
  const digits = raw.trim().replace(/\D/g, "")
  // Handle numbers already in international format
  const local = digits.startsWith("233") ? "0" + digits.slice(3)
              : digits.startsWith("0")   ? digits
              : digits.length === 9      ? "0" + digits
              : null
  if (!local || local.length < 3) return null
  return PREFIX_TO_PROVIDER[local.slice(0, 3)] ?? null
}

/**
 * Validate a Ghana phone number for the form — returns a user-visible
 * error string, or null if valid.
 */
export function validatePhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return "Enter your MoMo number"
  const digits = trimmed.replace(/\D/g, "")
  if (!/^\d+$/.test(digits)) return "Numbers only — no letters or symbols"

  // Resolve to local 10-digit form for prefix check
  let local: string | null = null
  if (digits.startsWith("233") && digits.length >= 12) local = "0" + digits.slice(3)
  else if (digits.startsWith("0") && digits.length === 10) local = digits
  else if (digits.length === 9) local = "0" + digits

  if (!local) {
    const len = digits.replace(/^(233|0)/, "").length
    return `Must be 10 digits starting with 0 (or +233…) — you have ${digits.length}`
  }

  const prefix = local.slice(0, 3)
  if (!PREFIX_TO_PROVIDER[prefix]) {
    return `"${prefix}" is not a recognised Ghana mobile prefix`
  }
  return null // valid
}

/**
 * Format a raw Ghana phone for display: 024 123 4567
 */
export function formatPhoneDisplay(raw: string): string {
  const digits = raw.trim().replace(/\D/g, "")
  let local = digits
  if (digits.startsWith("233") && digits.length >= 12) local = "0" + digits.slice(3)
  else if (digits.length === 9) local = "0" + digits
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
  return raw
}

/**
 * Prefix hint shown below the network selector.
 * e.g. "Valid prefixes: 024, 054, 055, 059"
 */
export function prefixHint(provider: MomoProvider): string {
  return `Valid prefixes: ${MOMO_NETWORKS[provider].prefixes.join(", ")}`
}

// ---------------------------------------------------------------------------
// Labels / placeholders — mirror packages/api/src/lib/ghana-locale.ts GHANA
// ---------------------------------------------------------------------------

export const GHANA_UI = {
  phoneExample:      "024 123 4567",
  phoneHint:         "Mobile (024…)",
  postalLabel:       "GhanaPostGPS (optional)",
  postalExample:     "GA-184-1234",
  addressPlaceholder:"Street, area, house no.",
  landmarkPlaceholder:"Near Goil, blue gate…",
  cityPlaceholder:   "Accra, Kumasi…",
  defaultRegion:     "Greater Accra" as GhanaRegion,
} as const
