/** Client for the API's street search (`/store/places`). Shape mirrors apps/api/src/lib/geocoder.ts. */

export type Pin = { lat: number; lng: number }

export type Place = Pin & {
  label: string
  detail: string
  street: string | null
  area: string | null
  city: string | null
  regionId: string | null
  regionName: string | null
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal })
  if (!res.ok) throw Object.assign(new Error(`places ${res.status}`), { status: res.status })
  return (await res.json()) as T
}

export function searchPlaces(apiBase: string, q: string, near: Pin | null, signal?: AbortSignal): Promise<Place[]> {
  const u = new URL(`${apiBase.replace(/\/$/, "")}/store/places/search`)
  u.searchParams.set("q", q)
  if (near) {
    u.searchParams.set("lat", String(near.lat))
    u.searchParams.set("lng", String(near.lng))
  }
  return get<{ places: Place[] }>(u.toString(), signal).then((r) => r.places)
}

export function reversePlace(apiBase: string, pin: Pin, signal?: AbortSignal): Promise<Place> {
  const u = new URL(`${apiBase.replace(/\/$/, "")}/store/places/reverse`)
  u.searchParams.set("lat", String(pin.lat))
  u.searchParams.set("lng", String(pin.lng))
  return get<{ place: Place }>(u.toString(), signal).then((r) => r.place)
}
