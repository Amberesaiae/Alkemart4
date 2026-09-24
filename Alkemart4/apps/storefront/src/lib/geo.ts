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
