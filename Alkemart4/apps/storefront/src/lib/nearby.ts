import { haversineKm } from "@alkemart/shared/ghana"

/**
 * The buyer's pin, and distance to shops.
 *
 * "Deliver to" is a region — it answers "same region or not", which cannot
 * rank a shop in Osu above one in Kasoa for a buyer in Labone. This is the
 * other half: a coordinate, so distance is a real number.
 *
 * The two are deliberately separate. Where you are is not always where you
 * want it delivered, and a buyer browsing from the office for a home delivery
 * must be able to say so.
 *
 * Privacy: the pin lives in this browser only. It is never sent to the API,
 * never logged, and distance is computed client-side against shop coordinates
 * that are already public on the shop page. Cleared with one tap.
 */

const KEY = "alkemart.pin"

export type BuyerPin = { lat: number; lng: number; at: number }

/** Ghana bounding box — a pin outside it is a bad read, not a location. */
function inGhana(lat: number, lng: number): boolean {
  return lat >= 4.0 && lat <= 11.8 && lng >= -3.8 && lng <= 1.8
}

export function readPin(): BuyerPin | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<BuyerPin>
    if (typeof p.lat !== "number" || typeof p.lng !== "number") return null
    if (!inGhana(p.lat, p.lng)) return null
    // A pin older than a week is probably not where the buyer is now.
    if (typeof p.at === "number" && Date.now() - p.at > 7 * 24 * 60 * 60 * 1000) return null
    return { lat: p.lat, lng: p.lng, at: p.at ?? Date.now() }
  } catch {
    return null
  }
}

export function writePin(pin: { lat: number; lng: number } | null): void {
  if (typeof window === "undefined") return
  try {
    if (pin && inGhana(pin.lat, pin.lng)) {
      window.localStorage.setItem(KEY, JSON.stringify({ ...pin, at: Date.now() }))
    } else {
      window.localStorage.removeItem(KEY)
    }
  } catch {
    /* private browsing — the pin just does not persist */
  }
  window.dispatchEvent(new CustomEvent("alkemart:pin"))
}

export type Located = { lat?: number | null; lng?: number | null }

/** Kilometres from the buyer's pin, or null when either side has no pin. */
export function distanceKm(pin: BuyerPin | null, target: Located): number | null {
  if (!pin) return null
  if (typeof target.lat !== "number" || typeof target.lng !== "number") return null
  return haversineKm(pin.lat, pin.lng, target.lat, target.lng)
}

/**
 * Distance as a shopper would say it. Under a kilometre is the difference
 * between "walk" and "take a trotro", so it earns metres.
 */
export function formatDistance(km: number | null): string | null {
  if (km === null || !Number.isFinite(km)) return null
  if (km < 1) return `${Math.round(km * 100) * 10} m away`
  if (km < 10) return `${km.toFixed(1)} km away`
  return `${Math.round(km)} km away`
}

/**
 * Nearest first; unpinned shops keep their original order behind the pinned
 * ones. A shop without coordinates is not "far away" — it is unknown, and
 * sorting it as infinitely distant would bury sellers for not having tapped a
 * button yet.
 */
export function sortByDistance<T extends Located>(items: readonly T[], pin: BuyerPin | null): T[] {
  if (!pin) return [...items]
  const withD = items.map((item, index) => ({ item, index, d: distanceKm(pin, item) }))
  return withD
    .sort((a, b) => {
      if (a.d === null && b.d === null) return a.index - b.index
      if (a.d === null) return 1
      if (b.d === null) return -1
      return a.d - b.d
    })
    .map((x) => x.item)
}
