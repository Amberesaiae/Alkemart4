/**
 * Live device location for easy setup (browser-only).
 *
 * Flow: HTML5 Geolocation → BigDataCloud free client-side reverse-geocode
 * (no key, browser-direct per their fair-use policy) → city/region guess.
 * Never proxy through our API — the free endpoint bans server-side use.
 */
import { GHANA_DISTRICTS, GHANA_REGIONS_LIST } from "@alkemart/shared/ghana"

export type LiveLocality = {
  latitude: number
  longitude: number
  city: string | null
  region: string | null
  district: string | null
}

type BigDataCloudLocality = {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryCode?: string
  latitude?: number
  longitude?: number
}

function getPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported on this device"))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        reject(new Error("Location permission was denied — pick your region manually"))
      } else if (err.code === err.TIMEOUT) {
        reject(new Error("Location timed out — try again or pick manually"))
      } else {
        reject(new Error("Could not read your location — pick manually"))
      }
    }, { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 })
  })
}

function matchRegion(name: string | undefined): string | null {
  if (!name) return null
  const hit = GHANA_REGIONS_LIST.find(
    (r) => r.toLowerCase() === name.trim().toLowerCase(),
  )
  return hit ?? null
}

function matchDistrict(region: string | null, locality: string | undefined): string | null {
  if (!region || !locality) return null
  const districts = GHANA_DISTRICTS[region] ?? []
  const needle = locality.trim().toLowerCase()
  return districts.find((d) => d.toLowerCase().includes(needle) || needle.includes(d.toLowerCase())) ?? null
}

/** Detect the device locality. Throws a human-readable Error on failure. */
export async function detectLiveLocality(timeoutMs = 12_000): Promise<LiveLocality> {
  const pos = await getPosition(timeoutMs)
  const { latitude, longitude } = pos.coords
  let raw: BigDataCloudLocality = {}
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    )
    if (res.ok) raw = (await res.json()) as BigDataCloudLocality
  } catch {
    raw = {}
  }
  if (raw.countryCode && raw.countryCode.toUpperCase() !== "GH") {
    throw new Error("That location looks outside Ghana — pick your region manually")
  }
  const region = matchRegion(raw.principalSubdivision)
  return {
    latitude,
    longitude,
    city: raw.city || raw.locality || null,
    region,
    district: matchDistrict(region, raw.locality || raw.city),
  }
}
