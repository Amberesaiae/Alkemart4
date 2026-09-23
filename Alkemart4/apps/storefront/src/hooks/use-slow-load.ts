import { useEffect, useState } from "react"

/**
 * True only while `loading` persists past `delayMs`. Skeletons flashing on
 * sub-second fetches read as flicker, not progress (NN/g: skip indicators
 * for <1s waits) — gate every full-region skeleton on this.
 */
export function useSlowLoad(loading: boolean, delayMs = 250): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!loading) {
      setSlow(false)
      return
    }
    const t = window.setTimeout(() => setSlow(true), delayMs)
    return () => window.clearTimeout(t)
  }, [loading, delayMs])
  return loading && slow
}
