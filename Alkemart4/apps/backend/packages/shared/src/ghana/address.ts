import { formatPhone } from "./phone"

export interface GhanaAddress {
  line1: string
  line2?: string
  city: string
  district: string
  region: string
  digitalAddress?: string
  phone: string
  postalCode?: string
}

export const REGION_CODES = {
  AH: "Ahafo",
  AS: "Ashanti",
  BO: "Bono",
  BE: "Bono East",
  CP: "Central",
  EP: "Eastern",
  GA: "Greater Accra",
  NE: "North East",
  NP: "Northern",
  OT: "Oti",
  SV: "Savannah",
  UE: "Upper East",
  UW: "Upper West",
  TV: "Volta",
  WP: "Western",
  WN: "Western North",
} as const satisfies Record<string, string>

export function isValidGpsAddress(code: string): boolean {
  return /^[A-Z]{2}-\d{3}-\d{4}$/.test(code)
}

export function parseGpsAddress(code: string): {
  regionCode: string
  districtCode: string
  uniqueId: string
} | null {
  if (!isValidGpsAddress(code)) return null
  const [regionCode, districtCode, uniqueId] = code.split("-")
  return { regionCode, districtCode, uniqueId }
}

export const GHANA_ADDRESS_COPY = {
  phoneLabel: "Mobile number",
  phonePlaceholder: "024 123 4567",
  phoneHint: "Mobile (024…)",
  addressLabel: "Street / house / area",
  addressPlaceholder: "House number, street, neighbourhood",
  landmarkLabel: "Landmark (optional)",
  landmarkPlaceholder: "Near Goil, blue gate…",
  cityLabel: "City / town",
  cityPlaceholder: "Accra, Kumasi…",
  regionLabel: "Region",
  regionPlaceholder: "Greater Accra…",
  countryLabel: "Country",
  postalLabel: "GhanaPostGPS (optional)",
  postalPlaceholder: "GA-184-1234",
  postalHint: "Optional digital address",
} as const

export function formatGhanaAddress(addr: GhanaAddress): string {
  const lines: string[] = [addr.line1]
  if (addr.line2) lines.push(addr.line2)
  const cityLine = addr.digitalAddress ? `${addr.city} — ${addr.digitalAddress}` : addr.city
  lines.push(cityLine)
  lines.push(addr.district)
  lines.push(addr.region.toUpperCase())
  lines.push("GHANA")
  if (addr.phone) lines.push(`Tel: ${formatPhone(addr.phone)}`)
  return lines.join("\n")
}
