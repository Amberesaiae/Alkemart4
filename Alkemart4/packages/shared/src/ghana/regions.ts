export interface Region {
  id: string
  name: string
  capital: string
  iso: string | null
  lat: string
  lon: string
}

export interface District {
  id: string
  name: string
  capital: string
  regionId: string
  lat: string
  lon: string
}

export interface Town {
  id: string
  name: string
  districtId: string
  lat: string
  lon: string
}

export const GHANA_REGIONS: Region[] = [
  { id: "GH01", name: "Ahafo", capital: "Goaso", iso: null, lat: "6.9333", lon: "-2.6167" },
  { id: "GH02", name: "Ashanti", capital: "Kumasi", iso: "GH-AH", lat: "6.6667", lon: "-1.6167" },
  { id: "GH03", name: "Bono", capital: "Sunyani", iso: "GH-BO", lat: "7.3333", lon: "-2.3333" },
  { id: "GH04", name: "Bono East", capital: "Techiman", iso: null, lat: "7.5833", lon: "-1.9333" },
  { id: "GH05", name: "Central", capital: "Cape Coast", iso: "GH-CP", lat: "5.5000", lon: "-1.0000" },
  { id: "GH06", name: "Eastern", capital: "Koforidua", iso: "GH-EP", lat: "6.5000", lon: "-0.5000" },
  { id: "GH07", name: "Greater Accra", capital: "Accra", iso: "GH-AA", lat: "5.5667", lon: "-0.2000" },
  { id: "GH08", name: "North East", capital: "Nalerigu", iso: null, lat: "10.5000", lon: "-0.1000" },
  { id: "GH09", name: "Northern", capital: "Tamale", iso: "GH-NP", lat: "9.5000", lon: "-1.0000" },
  { id: "GH10", name: "Oti", capital: "Dambai", iso: null, lat: "7.5000", lon: "0.3000" },
  { id: "GH11", name: "Savannah", capital: "Damongo", iso: null, lat: "9.2500", lon: "-1.8167" },
  { id: "GH12", name: "Upper East", capital: "Bolgatanga", iso: "GH-UE", lat: "10.7833", lon: "-0.8500" },
  { id: "GH13", name: "Upper West", capital: "Wa", iso: "GH-UW", lat: "10.0667", lon: "-2.5000" },
  { id: "GH14", name: "Volta", capital: "Ho", iso: "GH-TV", lat: "6.7667", lon: "0.7333" },
  { id: "GH15", name: "Western", capital: "Sekondi-Takoradi", iso: "GH-WP", lat: "5.0833", lon: "-2.0000" },
  { id: "GH16", name: "Western North", capital: "Sefwi Wiawso", iso: null, lat: "6.2000", lon: "-2.4833" },
] as const

export const GHANA_REGIONS_LIST = GHANA_REGIONS.map((r) => r.name) as readonly string[]

export function getRegionById(id: string): Region | undefined {
  return GHANA_REGIONS.find((r) => r.id === id)
}

export function getRegionByName(name: string): Region | undefined {
  return GHANA_REGIONS.find((r) => r.name.toLowerCase() === name.toLowerCase())
}

export const GHANA_MAJOR_CITIES = [
  "Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast",
  "Tema", "Sunyani", "Ho", "Koforidua", "Wa", "Bolgatanga",
] as const
