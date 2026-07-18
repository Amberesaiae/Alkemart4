/**
 * Ghana marketplace defaults for onboarding, addresses, money, and shipping.
 * Use these instead of EU seed leftovers (EUR, DE, Berlin).
 */

export const GHANA = {
  countryCode: "gh",
  countryName: "Ghana",
  currencyCode: "ghs",
  currencySymbol: "GH₵",
  phoneCountryCode: "+233",
  phoneExample: "024 123 4567",
  phoneHint: "Ghana mobile (MTN, Telecel, AT) — e.g. 024… or +23324…",
  postalLabel: "GhanaPostGPS (optional)",
  postalExample: "GA-184-1234",
  postalHint:
    "Digital address helps riders when available — not required for cash on delivery.",
  regionLabel: "Region",
  cityLabel: "City / town",
  addressLabel: "Street / house / area",
  landmarkLabel: "Landmark / directions (optional)",
  landmarkExample: "Near Goil station, blue gate…",
  defaultCity: "Accra",
  defaultRegion: "Greater Accra",
  defaultAddressLine: "Spintex Road",
} as const

/** 16 administrative regions of Ghana (for dropdowns / hints). */
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

export const GHANA_MAJOR_CITIES = [
  "Accra",
  "Kumasi",
  "Tamale",
  "Takoradi",
  "Cape Coast",
  "Tema",
  "Sunyani",
  "Ho",
  "Koforidua",
  "Wa",
  "Bolgatanga",
] as const

export function isGhanaCountry(code: string | null | undefined): boolean {
  return (code || "").trim().toLowerCase() === "gh"
}
