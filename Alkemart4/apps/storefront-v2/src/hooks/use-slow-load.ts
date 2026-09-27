import { useEffect, useState } from "react"

/**
 * True only once a load has run longer than `delayMs`. Fast cache hits never
 * flash a skeleton; genuinely slow loads get one.
 */
export function useSlowLoad(loading: boolean, delayMs = 250): boolean {
  const [slow, setSlow] = useState(false)
  // Reset during render when the load ends (React's "adjust state" pattern).
  if (!loading && slow) setSlow(false)
  useEffect(() => {
    if (!loading) return
    const t = window.setTimeout(() => setSlow(true), delayMs)
    return () => window.clearTimeout(t)
  }, [loading, delayMs])
  return loading && slow
}
