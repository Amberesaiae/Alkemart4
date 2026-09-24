import { getAlkemartApiUrl } from "./env"

/**
 * Coarse location hint derived from the request IP by Cloudflare.
 *
 * A hint, not an address — it seeds "Deliver to" so a first-time buyer sees
 * their own region without being asked. Never used for checkout; never
 * overrides a choice the buyer made.
 */
export type GeoHint = {
  country: string | null
  region: string | null
  regionId: string | null
  city: string | null
}

const EMPTY: GeoHint = { country: null, region: null, regionId: null, city: null }

/**
 * Resolves to an empty hint rather than throwing. Location is a nicety: a
 * blocked request, an offline buyer or a cold Worker must degrade to "show
 * everything", never to an error boundary over the whole storefront.
 */
export async function fetchGeoHint(signal?: AbortSignal): Promise<GeoHint> {
  const base = getAlkemartApiUrl()
  if (!base) return EMPTY
  try {
    const res = await fetch(`${base}/store/geo`, {
      headers: { Accept: "application/json" },
      signal,
    })
    if (!res.ok) return EMPTY
    const raw = (await res.json()) as Partial<GeoHint>
    return {
      country: typeof raw.country === "string" ? raw.country : null,
      region: typeof raw.region === "string" ? raw.region : null,
      regionId: typeof raw.regionId === "string" ? raw.regionId : null,
      city: typeof raw.city === "string" ? raw.city : null,
    }
  } catch {
    return EMPTY
  }
}

/**
 * Precise location, on explicit request only.
 *
 * Why this exists alongside the IP hint: on a Ghanaian mobile network the IP
 * frequently resolves to the carrier's gateway in Accra regardless of where
 * the handset actually is, so a buyer in Tamale is told "Greater Accra". GPS
 * is the only thing that fixes that.
 *
 * Never called on page load. A geolocation prompt fired cold gets denied, and
 * Chrome then suppresses future prompts for the origin — one bad prompt costs
 * the feature permanently. It runs on an explicit tap.
 *
 * Privacy: coordinates are resolved to a region in the browser, and only the
 * region name is kept. The raw position is never sent anywhere, never stored,
 * and never logged.
 */
export type PreciseResult =
  | { ok: true; region: string }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "outside-ghana" }

export async function locatePrecisely(
  nearestRegion: (lat: number, lon: number) => { name: string } | null,
): Promise<PreciseResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "unsupported" }
  }
  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      // A 10s cap and a 5-minute cache: a buyer on a weak signal should not
      // watch a spinner, and re-asking the GPS on every tap drains battery.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  })
  if (!position) return { ok: false, reason: "denied" }
  const region = nearestRegion(position.coords.latitude, position.coords.longitude)
  if (!region) return { ok: false, reason: "outside-ghana" }
  return { ok: true, region: region.name }
}
