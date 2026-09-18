import { useCallback, useEffect, useState } from "react"
import { GHANA_REGIONS } from "@alkemart/shared/ghana"

/**
 * Where the buyer wants things delivered — a browsing context, not an address.
 *
 * It sorts shops by proximity, drives "Only in <area>" shelves and pre-fills
 * checkout. Deliberately optional: an unset area means the storefront shows
 * everything rather than blocking on a modal before anyone has seen a product.
 *
 * Reuses the canonical Ghana region list rather than inventing a second
 * geography that would drift from the one checkout validates against.
 */

const STORAGE_KEY = "alkemart.deliver-to"
const EVENT = "alkemart:deliver-to"

export type DeliverToArea = { name: string }

export const DELIVER_TO_AREAS: DeliverToArea[] = GHANA_REGIONS.map((r) => ({ name: r.name }))

function read(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    // Guard against a stale value from an earlier region list.
    return DELIVER_TO_AREAS.some((a) => a.name === raw) ? raw : null
  } catch {
    // Private browsing and blocked site data both throw here. A buyer with
    // no storage still gets a working storefront, just without a saved area.
    return null
  }
}

export function getDeliverTo(): string | null {
  if (typeof window === "undefined") return null
  return read()
}

export function setDeliverTo(area: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (area) window.localStorage.setItem(STORAGE_KEY, area)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* Storage unavailable — keep the in-memory value for this page view. */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: area }))
}

/** Subscribes to changes, so every surface reacts to one picker. */
export function useDeliverTo(): [string | null, (area: string | null) => void] {
  const [area, setArea] = useState<string | null>(() => getDeliverTo())

  useEffect(() => {
    const sync = () => setArea(getDeliverTo())
    window.addEventListener(EVENT, sync)
    // Another tab changing the area should not leave this one stale.
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  const update = useCallback((next: string | null) => {
    setDeliverTo(next)
    setArea(next)
  }, [])

  return [area, update]
}

/** Loose match: a shop's stored region against the buyer's chosen area. */
export function matchesArea(shopLocation: string | null | undefined, area: string | null): boolean {
  if (!area) return true
  if (!shopLocation) return false
  return shopLocation.trim().toLowerCase() === area.trim().toLowerCase()
}
