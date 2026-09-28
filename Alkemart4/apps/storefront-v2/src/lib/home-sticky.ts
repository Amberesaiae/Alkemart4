import { useSyncExternalStore } from "react"

/**
 * Phone home: once the hero's search scrolls under the header, the header
 * takes over search plus a compact row of department chips. The hero
 * publishes what it scrolled away; the header only renders it.
 */
export type StickyChip = { label: string; slug: string }
type State = { stuck: boolean; chips: StickyChip[] }

let state: State = { stuck: false, chips: [] }
const listeners = new Set<() => void>()

export function setHomeSticky(next: Partial<State>) {
  const merged = { ...state, ...next }
  if (merged.stuck === state.stuck && merged.chips === state.chips) return
  state = merged
  listeners.forEach((l) => l())
}

export function useHomeSticky(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
}
