import { useCallback, useSyncExternalStore } from "react"

/**
 * Saved items — kept on this device only. Wishlist persistence is not in
 * the Workers system of record (LIFECYCLE-BUYER "Not in SoR yet"), so the
 * UI labels this list "Saved on this device" and never implies an account
 * sync. Stores the card fields needed to render the list offline.
 */
export type SavedItem = {
  id: string
  title: string
  slug?: string | null
  thumbnail?: string | null
  amount?: number | null
  currencyCode?: string | null
  savedAt: string
}

const KEY = "alkemart.storefront.saved_items"
const EVENT = "alkemart:saved-items"
const MAX = 100

function read(): SavedItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown
    return Array.isArray(raw)
      ? raw.filter(
          (x): x is SavedItem =>
            !!x && typeof x === "object" && typeof (x as SavedItem).id === "string",
        )
      : []
  } catch {
    return []
  }
}

let snapshot: SavedItem[] = typeof window === "undefined" ? [] : read()

function write(list: SavedItem[]) {
  snapshot = list
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Pure toggle: adds to the front, or removes when already saved. */
export function toggleSaved(
  list: SavedItem[],
  item: Omit<SavedItem, "savedAt">,
  now = new Date(),
): SavedItem[] {
  if (list.some((x) => x.id === item.id)) return list.filter((x) => x.id !== item.id)
  return [{ ...item, savedAt: now.toISOString() }, ...list].slice(0, MAX)
}

function subscribe(cb: () => void) {
  const sync = () => {
    snapshot = read()
    cb()
  }
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", sync)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", sync)
  }
}

export function useSavedItems() {
  const items = useSyncExternalStore(subscribe, () => snapshot, () => [])
  const toggle = useCallback(
    (item: Omit<SavedItem, "savedAt">) => write(toggleSaved(snapshot, item)),
    [],
  )
  const remove = useCallback((id: string) => write(snapshot.filter((x) => x.id !== id)), [])
  const isSaved = useCallback((id: string) => items.some((x) => x.id === id), [items])
  return { items, toggle, remove, isSaved }
}
