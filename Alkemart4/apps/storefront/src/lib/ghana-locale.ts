export const GHANA_REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
  "Greater Accra", "North East", "Northern", "Oti", "Savannah",
  "Upper East", "Upper West", "Volta", "Western", "Western North",
] as readonly string[]

export const GHANA_MAJOR_CITIES = [
  "Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast",
  "Tema", "Sunyani", "Ho", "Koforidua", "Wa", "Bolgatanga",
] as const

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
