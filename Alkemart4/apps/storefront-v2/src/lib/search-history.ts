import { useCallback, useSyncExternalStore } from "react"

/**
 * Recent searches, kept on this device only. There is no Workers search
 * history API; nothing here leaves the browser.
 */
const KEY = "alkemart.storefront.recent_searches"
const MAX = 8
const EVENT = "alkemart:recent-searches"

function read(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []
  } catch {
    return []
  }
}

let snapshot = typeof window === "undefined" ? [] : read()

function write(list: string[]) {
  snapshot = list
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Pure: newest first, de-duplicated case-insensitively, capped. */
export function pushRecent(list: string[], query: string, max = MAX): string[] {
  const q = query.trim()
  if (!q) return list
  return [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, max)
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

export function useSearchHistory() {
  const recent = useSyncExternalStore(subscribe, () => snapshot, () => [])
  const trackSearch = useCallback((q: string) => write(pushRecent(snapshot, q)), [])
  const removeQuery = useCallback(
    (q: string) => write(snapshot.filter((x) => x !== q)),
    [],
  )
  const clearAll = useCallback(() => write([]), [])
  return { recent, trackSearch, removeQuery, clearAll }
}
