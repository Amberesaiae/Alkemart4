import { Hono } from "hono"
import { z } from "zod"
import type { AppEnv } from "../../context"
import { GeocoderUnavailable, inGhana, reversePlace, searchPlaces, type GeocoderConfig } from "../../lib/geocoder"

/**
 * Street search and pin lookup for the location picker (seller dispatch spot,
 * buyer delivery spot). Public, rate-limited, Ghana only.
 *
 * Caching: a search answer depends only on the words typed, so it may be
 * shared at the edge. A reverse lookup is someone's position — private cache
 * only, never shared.
 */

const Coord = z.coerce.number().finite()
const SearchQuery = z.object({
  q: z.string().trim().min(3).max(120),
  lat: Coord.optional(),
  lng: Coord.optional(),
})
const ReverseQuery = z.object({ lat: Coord, lng: Coord })

const configOf = (env: AppEnv["Bindings"] | undefined): GeocoderConfig => {
  const e = (env ?? {}) as { GEOCODER_URL?: string; GEOCODER_KEY?: string; GEOCODER_EMAIL?: string }
  return { baseUrl: e.GEOCODER_URL, key: e.GEOCODER_KEY, email: e.GEOCODER_EMAIL }
}

const unavailable = { error: "places_unavailable", message: "Street search isn't answering. Drop the pin on the map instead." }

export const storePlaces = new Hono<AppEnv>()
  .get("/search", async (c) => {
    const parsed = SearchQuery.safeParse(c.req.query())
    if (!parsed.success) return c.json({ places: [] })
    const { q, lat, lng } = parsed.data
    const near = lat != null && lng != null && inGhana(lat, lng) ? { lat, lng } : undefined
    try {
      const places = await searchPlaces(configOf(c.env), q, near)
      c.header("Cache-Control", near ? "private, max-age=3600" : "public, max-age=3600, s-maxage=86400")
      return c.json({ places })
    } catch (err) {
      if (err instanceof GeocoderUnavailable) {
        c.header("Cache-Control", "no-store")
        return c.json(unavailable, 503)
      }
      throw err
    }
  })
  .get("/reverse", async (c) => {
    const parsed = ReverseQuery.safeParse(c.req.query())
    if (!parsed.success) return c.json({ error: "invalid_coordinates" }, 400)
    const { lat, lng } = parsed.data
    if (!inGhana(lat, lng)) return c.json({ error: "outside_ghana", message: "That spot is outside Ghana." }, 422)
    try {
      const place = await reversePlace(configOf(c.env), lat, lng)
      c.header("Cache-Control", "private, max-age=3600")
      return c.json({ place })
    } catch (err) {
      if (err instanceof GeocoderUnavailable) {
        c.header("Cache-Control", "no-store")
        return c.json(unavailable, 503)
      }
      throw err
    }
  })
