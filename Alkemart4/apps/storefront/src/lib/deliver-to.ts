import { useCallback, useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { GHANA_REGIONS } from "@alkemart/shared/ghana"
import { fetchGeoHint } from "./geo"

/**
 * Where the buyer wants things delivered — a browsing context, not an address.
 *
 * It sorts shops by proximity, drives "Only in <area>" shelves and pre-fills
 * checkout. Deliberately optional: an unset area means the storefront shows
 * everything rather than blocking on a modal before anyone has seen a product.
 *
 * Reuses the canonical Ghana region list rather than inventing a second
 * geography that would drift from the one checkout validates against.
 *
 * Two layers, and the order matters:
 *
 *   1. What the buyer chose      — persisted, always wins, including an
 *                                  explicit "show everywhere".
 *   2. Cloudflare's IP region    — a silent default for a first-time visitor
 *                                  so the picker starts correct instead of
 *                                  guessing Accra at everyone.
 *
 * The hint is never persisted. A buyer who has chosen is never asked again and
 * never re-geolocated — `useQuery` stays disabled for them, so returning
 * visitors make no geo request at all.
 */

const STORAGE_KEY = "alkemart.deliver-to"
const EVENT = "alkemart:deliver-to"

export type DeliverToArea = { name: string }

export const DELIVER_TO_AREAS: DeliverToArea[] = GHANA_REGIONS.map((r) => ({ name: r.name }))

/** A stored decision. `chosen: false` means the buyer has never decided. */
type Choice = { chosen: boolean; area: string | null }

const NO_CHOICE: Choice = { chosen: false, area: null }

const isKnownArea = (v: string) => DELIVER_TO_AREAS.some((a) => a.name === v)

function read(): Choice {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return NO_CHOICE
    // Envelope form, written since IP defaulting landed. Distinguishes
    // "chose everywhere" from "never chose", which a bare string cannot.
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as { area?: unknown }
      const area = typeof parsed.area === "string" ? parsed.area : null
      if (area && !isKnownArea(area)) return NO_CHOICE
      return { chosen: true, area }
    }
    // Legacy form: a bare region name, always an explicit choice.
    return isKnownArea(raw) ? { chosen: true, area: raw } : NO_CHOICE
  } catch {
    // Private browsing and blocked site data both throw here. A buyer with
    // no storage still gets a working storefront, just without a saved area.
    return NO_CHOICE
  }
}

export function getDeliverTo(): string | null {
  if (typeof window === "undefined") return null
  return read().area
}

/** True once the buyer has made a decision — including "show everywhere". */
export function hasChosenDeliverTo(): boolean {
  if (typeof window === "undefined") return false
  return read().chosen
}

export function setDeliverTo(area: string | null): void {
  if (typeof window === "undefined") return
  try {
    // Persist the decision itself, so "everywhere" survives a reload instead
    // of being re-guessed from the buyer's IP on the next page view.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, area }))
  } catch {
    /* Storage unavailable — keep the in-memory value for this page view. */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: area }))
}

/** Subscribes to changes, so every surface reacts to one picker. */
export function useDeliverTo(): [string | null, (area: string | null) => void] {
  const [choice, setChoice] = useState<Choice>(() =>
    typeof window === "undefined" ? NO_CHOICE : read(),
  )

  useEffect(() => {
    const sync = () => setChoice(read())
    window.addEventListener(EVENT, sync)
    // Another tab changing the area should not leave this one stale.
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  // Only ask where the buyer is when they have not already told us.
  const hint = useQuery({
    queryKey: ["store", "geo"],
    queryFn: ({ signal }) => fetchGeoHint(signal),
    enabled: !choice.chosen,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const update = useCallback((next: string | null) => {
    setDeliverTo(next)
    setChoice({ chosen: true, area: next })
  }, [])

  const area = choice.chosen ? choice.area : (hint.data?.region ?? null)
  return [area, update]
}

/** True when the current area came from the IP hint, not from the buyer. */
export function useDeliverToIsDetected(): boolean {
  const [area] = useDeliverTo()
  return area !== null && !hasChosenDeliverTo()
}

/** Loose match: a shop's stored region against the buyer's chosen area. */
export function matchesArea(shopLocation: string | null | undefined, area: string | null): boolean {
  if (!area) return true
  if (!shopLocation) return false
  return shopLocation.trim().toLowerCase() === area.trim().toLowerCase()
}
