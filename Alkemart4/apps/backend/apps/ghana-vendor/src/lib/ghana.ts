/**
 * Ghana market constants and utilities
 * Regions: official 16 regions as of 2019 reorganisation
 * MoMo: NCA-assigned prefixes (valid as of 2024)
 */

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export const GHANA_REGIONS = [
  { value: "greater-accra", label: "Greater Accra", capital: "Accra" },
  { value: "ashanti", label: "Ashanti", capital: "Kumasi" },
  { value: "western", label: "Western", capital: "Sekondi-Takoradi" },
  { value: "western-north", label: "Western North", capital: "Sefwi Wiawso" },
  { value: "central", label: "Central", capital: "Cape Coast" },
  { value: "eastern", label: "Eastern", capital: "Koforidua" },
  { value: "volta", label: "Volta", capital: "Ho" },
  { value: "oti", label: "Oti", capital: "Dambai" },
  { value: "bono", label: "Bono", capital: "Sunyani" },
  { value: "bono-east", label: "Bono East", capital: "Techiman" },
  { value: "ahafo", label: "Ahafo", capital: "Goaso" },
  { value: "northern", label: "Northern", capital: "Tamale" },
  { value: "savannah", label: "Savannah", capital: "Damongo" },
  { value: "north-east", label: "North East", capital: "Nalerigu" },
  { value: "upper-east", label: "Upper East", capital: "Bolgatanga" },
  { value: "upper-west", label: "Upper West", capital: "Wa" },
] as const

export type GhanaRegion = (typeof GHANA_REGIONS)[number]["value"]

// ---------------------------------------------------------------------------
// Mobile Money networks and their NCA-assigned prefixes
// ---------------------------------------------------------------------------

export const MOMO_NETWORKS = {
  mtn: {
    label: "MTN Mobile Money",
    prefixes: ["024", "054", "055", "059"],
    color: "#FFCC00",
    textColor: "#1a1a1a",
  },
  telecel: {
    label: "Telecel Cash",
    prefixes: ["020", "050"],
    color: "#CC0000",
    textColor: "#ffffff",
  },
  airteltigo: {
    label: "AT Money (AirtelTigo)",
    prefixes: ["026", "027", "056", "057"],
    color: "#E40000",
    textColor: "#ffffff",
  },
} as const

export type MoMoNetwork = keyof typeof MOMO_NETWORKS

// All valid Ghana mobile prefixes flat list
const ALL_PREFIXES: Record<string, MoMoNetwork> = {}
for (const [net, info] of Object.entries(MOMO_NETWORKS)) {
  for (const prefix of info.prefixes) {
    ALL_PREFIXES[prefix] = net as MoMoNetwork
  }
}

// ---------------------------------------------------------------------------
// Phone utilities
// ---------------------------------------------------------------------------

/**
 * Strip spaces, dashes, and the country code (+233 / 00233) so we always
 * work with a bare 10-digit local number starting with 0.
 */
export function normalisePhone(raw: string): string {
  let s = raw.replace(/[\s\-().]/g, "")
  if (s.startsWith("+233")) s = "0" + s.slice(4)
  if (s.startsWith("00233")) s = "0" + s.slice(5)
  if (s.startsWith("233") && s.length === 12) s = "0" + s.slice(3)
  return s
}

/**
 * Detect MoMo network from a Ghana phone number.
 * Returns null if the prefix is unknown or the number is too short.
 */
export function detectNetwork(raw: string): MoMoNetwork | null {
  const n = normalisePhone(raw)
  if (n.length < 3) return null
  return ALL_PREFIXES[n.slice(0, 3)] ?? null
}

/**
 * Validate a Ghana mobile number.
 * Must be 10 digits, start with a known MoMo prefix.
 */
export function validateGhanaPhone(raw: string): { valid: boolean; message: string } {
  const n = normalisePhone(raw)
  if (!n) return { valid: false, message: "Enter your MoMo number" }
  if (!/^\d+$/.test(n)) return { valid: false, message: "Numbers only, no letters" }
  if (n.length !== 10) return { valid: false, message: `Must be 10 digits (yours is ${n.length})` }
  if (!n.startsWith("0")) return { valid: false, message: "Must start with 0" }
  const prefix = n.slice(0, 3)
  if (!ALL_PREFIXES[prefix]) {
    return { valid: false, message: `"${prefix}" is not a recognised Ghana mobile prefix` }
  }
  return { valid: true, message: "" }
}

/**
 * Format a normalised Ghana number for display: 024 123 4567
 */
export function formatGhanaPhone(raw: string): string {
  const n = normalisePhone(raw).replace(/\D/g, "")
  if (n.length !== 10) return raw
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
}

/**
 * Return the hint string shown under the network selector:
 * "Valid prefixes: 024, 054, 055, 059"
 */
export function networkPrefixHint(network: MoMoNetwork): string {
  return `Valid prefixes: ${MOMO_NETWORKS[network].prefixes.join(", ")}`
}
