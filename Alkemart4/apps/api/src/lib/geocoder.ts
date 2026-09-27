import { getRegionByName, nearestRegionByCoords } from "@alkemart/shared/ghana"

/**
 * Street-level search and "what's at this pin" for Ghana, shared by the
 * seller's dispatch location and the buyer's delivery spot.
 *
 * The provider speaks the Nominatim API. By default that is the public
 * OpenStreetMap server, which allows light use only (about one request a
 * second, no heavy autocomplete) — fine for development. Before launch set
 * GEOCODER_URL + GEOCODER_KEY to a Nominatim-compatible paid host (LocationIQ,
 * or a self-hosted Nominatim); no code changes.
 *
 * Privacy: queries and coordinates go to the provider and nowhere else. They
 * are never logged or stored here.
 */

export type Place = {
  lat: number
  lng: number
  /** Short line: the place or street name. */
  label: string
  /** Second line: area, town, region. */
  detail: string
  street: string | null
  area: string | null
  city: string | null
  regionId: string | null
  regionName: string | null
}

export type GeocoderConfig = {
  baseUrl?: string
  key?: string
  /** Contact address sent to the public OSM server, as its policy asks. */
  email?: string
  fetch?: typeof fetch
}

const DEFAULT_BASE = "https://nominatim.openstreetmap.org"
/** Ghana's bounding box, so a stray pin or result from abroad is refused. */
export const GHANA_BOUNDS = { south: 4.0, north: 11.8, west: -3.8, east: 1.8 }

export const inGhana = (lat: number, lng: number) =>
  lat >= GHANA_BOUNDS.south && lat <= GHANA_BOUNDS.north && lng >= GHANA_BOUNDS.west && lng <= GHANA_BOUNDS.east

type NominatimAddress = Partial<
  Record<
    | "road"
    | "pedestrian"
    | "footway"
    | "house_number"
    | "neighbourhood"
    | "suburb"
    | "quarter"
    | "hamlet"
    | "city_district"
    | "city"
    | "town"
    | "village"
    | "municipality"
    | "county"
    | "state"
    | "region",
    string
  >
>

type NominatimItem = {
  lat: string
  lon: string
  name?: string
  display_name?: string
  address?: NominatimAddress
}

const clean = (v: string | undefined | null) => (v && v.trim() ? v.trim() : null)

function regionOf(state: string | null, lat: number, lng: number) {
  const byName = state ? (getRegionByName(state) ?? getRegionByName(state.replace(/\s+region$/i, ""))) : undefined
  const r = byName ?? nearestRegionByCoords(lat, lng)
  return { regionId: r?.id ?? null, regionName: r?.name ?? null }
}

export function toPlace(item: NominatimItem): Place | null {
  const lat = Number(item.lat)
  const lng = Number(item.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inGhana(lat, lng)) return null
  const a = item.address ?? {}
  const road = clean(a.road ?? a.pedestrian ?? a.footway)
  const street = road ? [clean(a.house_number), road].filter(Boolean).join(" ") : null
  const area = clean(a.neighbourhood ?? a.suburb ?? a.quarter ?? a.hamlet ?? a.city_district)
  // Many towns are only mapped as their district ("La-Nkwantanang-Madina
  // Municipal District"); keep the name, drop the admin suffix.
  const city = clean((a.city ?? a.town ?? a.village ?? a.municipality ?? a.county)?.replace(/\s+(municipal|metropolitan)?\s*(district|assembly)$/i, ""))
  const { regionId, regionName } = regionOf(clean(a.state ?? a.region), lat, lng)
  const name = clean(item.name)
  const label = name ?? street ?? area ?? city ?? clean(item.display_name?.split(",")[0]) ?? "Pinned spot"
  const detail = [name && street && name !== street ? street : null, area !== label ? area : null, city !== label ? city : null, regionName]
    .filter(Boolean)
    .filter((v, i, all) => all.indexOf(v) === i)
    .join(", ")
  return { lat: round(lat), lng: round(lng), label, detail, street, area, city, regionId, regionName }
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

export class GeocoderUnavailable extends Error {}

async function call(cfg: GeocoderConfig, path: string, params: Record<string, string>): Promise<unknown> {
  // Relative join keeps a base path such as LocationIQ's "/v1/".
  const base = (cfg.baseUrl ?? DEFAULT_BASE).replace(/\/?$/, "/")
  const url = new URL(path.replace(/^\//, ""), base)
  for (const [k, v] of Object.entries({ format: "jsonv2", addressdetails: "1", "accept-language": "en", ...params })) {
    url.searchParams.set(k, v)
  }
  if (cfg.key) url.searchParams.set("key", cfg.key)
  if (cfg.email && !cfg.key) url.searchParams.set("email", cfg.email)
  const res = await (cfg.fetch ?? fetch)(url.toString(), {
    headers: { Accept: "application/json", "User-Agent": "alkemart/1.0 (marketplace; Ghana)" },
    signal: AbortSignal.timeout(6_000),
  }).catch(() => null)
  if (!res) throw new GeocoderUnavailable("no answer")
  if (res.status === 404) return []
  if (!res.ok) throw new GeocoderUnavailable(`status ${res.status}`)
  return res.json()
}

/** Places matching a typed query, Ghana only, nearest to `near` first when given. */
export async function searchPlaces(cfg: GeocoderConfig, q: string, near?: { lat: number; lng: number }): Promise<Place[]> {
  const params: Record<string, string> = { q, countrycodes: "gh", limit: "8" }
  if (near) {
    // Bias, not a fence: a box about 30 km around the point.
    const d = 0.3
    params.viewbox = [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(",")
  }
  const raw = await call(cfg, "/search", params)
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Place[] = []
  for (const item of raw as NominatimItem[]) {
    const p = toPlace(item)
    if (!p) continue
    const k = `${p.label}|${p.detail}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out.slice(0, 6)
}

/** What's at a pin: the nearest street, area and town. */
export async function reversePlace(cfg: GeocoderConfig, lat: number, lng: number): Promise<Place> {
  const raw = (await call(cfg, "/reverse", { lat: String(lat), lon: String(lng), zoom: "18" })) as NominatimItem & { error?: string }
  const place = raw && !raw.error ? toPlace({ ...raw, lat: String(lat), lon: String(lng) }) : null
  if (place) return place
  // Nothing mapped here (common off main roads): still give the region.
  const { regionId, regionName } = regionOf(null, lat, lng)
  return { lat: round(lat), lng: round(lng), label: "Pinned spot", detail: regionName ?? "", street: null, area: null, city: null, regionId, regionName }
}
