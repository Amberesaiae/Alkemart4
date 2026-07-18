/**
 * Shared Ghana address / phone copy for storefront forms.
 */

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

export const GHANA_ADDRESS_COPY = {
  phoneLabel: "Mobile number",
  phonePlaceholder: "024 123 4567",
  phoneHint: "Ghana number for delivery & MoMo (MTN, Telecel, AT)",
  addressLabel: "Street / house / area",
  addressPlaceholder: "House number, street, neighbourhood",
  landmarkLabel: "Landmark / directions (optional)",
  landmarkPlaceholder: "Near Goil station, blue gate…",
  cityLabel: "City / town",
  cityPlaceholder: "e.g. Accra, Kumasi, Tema",
  regionLabel: "Region",
  regionPlaceholder: "e.g. Greater Accra",
  countryLabel: "Country",
  postalLabel: "GhanaPostGPS (optional)",
  postalPlaceholder: "e.g. GA-184-1234",
  postalHint:
    "Digital address helps riders when available — not required for cash on delivery.",
} as const
