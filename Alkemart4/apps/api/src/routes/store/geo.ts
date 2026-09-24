import { Hono } from "hono"
import {
  getRegionByName,
  nearestRegionByCoords,
  type Region,
} from "@alkemart/shared/ghana"
import type { AppEnv } from "../../context"

/**
 * Coarse, IP-derived location for the buyer's browsing context.
 *
 * Cloudflare attaches geo to every request (`request.cf`) at no cost and with
 * no permission prompt, so the storefront can default "Deliver to" to the
 * right region before the buyer touches anything. This is a *hint*, never an
 * address: an explicit choice always wins, and checkout still collects a real
 * delivery address.
 *
 * Privacy: the response is region/city only. Raw coordinates are used to pick
 * a region and are never returned, logged, or stored. Nothing here is
 * personally identifying on its own, and nothing is persisted server-side.
 *
 * Caching: the answer varies per client IP, so this route must stay on
 * `noStoreHeaders`. Never give it an `edgeCache()` kind — a cached region
 * would hand one buyer another buyer's location.
 */

type CfGeo = {
  country?: unknown
  region?: unknown
  city?: unknown
  latitude?: unknown
  longitude?: unknown
}

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length ? t : null
}

const num = (v: unknown): number | null => {
  const s = str(v)
  if (s === null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Region label first (exact list match), coordinates as the fallback. */
function resolveRegion(cf: CfGeo): Region | null {
  const label = str(cf.region)
  if (label) {
    const byName = getRegionByName(label)
    if (byName) return byName
    // Cloudflare sometimes labels the region "Greater Accra Region".
    const trimmed = label.replace(/\s+region$/i, "")
    const byTrimmed = getRegionByName(trimmed)
    if (byTrimmed) return byTrimmed
  }
  const lat = num(cf.latitude)
  const lon = num(cf.longitude)
  if (lat === null || lon === null) return null
  return nearestRegionByCoords(lat, lon)
}

export const storeGeo = new Hono<AppEnv>().get("/", (c) => {
  const cf = ((c.req.raw as { cf?: CfGeo }).cf ?? {}) as CfGeo
  const country = str(cf.country)

  // Only claim a region for Ghanaian traffic. A visitor abroad gets a null
  // region and the storefront shows everything, which is the honest default.
  if (country !== "GH") {
    return c.json({ country, region: null, regionId: null, city: null })
  }

  const region = resolveRegion(cf)
  return c.json({
    country,
    region: region?.name ?? null,
    regionId: region?.id ?? null,
    city: str(cf.city),
  })
})
