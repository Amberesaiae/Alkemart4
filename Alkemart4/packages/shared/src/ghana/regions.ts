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

/**
 * Canonical region ID — accepts an ID ("GH07") or display name
 * ("Greater Accra"). Writes should always store the result of this.
 */
export function resolveRegionId(input: string): string | null {
  const v = input.trim()
  return getRegionById(v)?.id ?? getRegionByName(v)?.id ?? null
}

/** Display name for a stored region value (ID or legacy name). */
export function displayRegionName(stored: string | null | undefined): string | null {
  if (!stored) return null
  return getRegionById(stored)?.name ?? getRegionByName(stored)?.name ?? stored
}

/**
 * Nearest region to a coordinate pair, by great-circle distance to each
 * region's reference point.
 *
 * Used to resolve an IP-derived coordinate (Cloudflare `request.cf`) onto the
 * canonical region list when the provider's region label does not match one of
 * ours. Region centroids are coarse, so this answers "which region is this
 * most likely in", never "where exactly is this buyer".
 *
 * Returns null for coordinates outside a generous Ghana bounding box, so a
 * VPN in Frankfurt resolves to nothing rather than to Greater Accra.
 */
export function nearestRegionByCoords(lat: number, lon: number): Region | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  // Ghana spans roughly 4.5..11.2 N and -3.3..1.3 E; pad for border towns.
  if (lat < 4.0 || lat > 11.8 || lon < -3.8 || lon > 1.8) return null

  let best: Region | null = null
  let bestKm = Number.POSITIVE_INFINITY
  for (const region of GHANA_REGIONS) {
    const km = haversineKm(lat, lon, Number(region.lat), Number(region.lon))
    if (km < bestKm) {
      bestKm = km
      best = region
    }
  }
  return best
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}
