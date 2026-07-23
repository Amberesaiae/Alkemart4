import { useEffect, useRef, useState } from "react"
import { useRouterState } from "@tanstack/react-router"

/**
 * Live-region announcer for route changes (WCAG 2.4.3 / 4.1.3).
 * Reads the document title after navigation and announces it to
 * screen readers via an aria-live polite region.
 */
export function RouteAnnouncer() {
  const announcement = useRouterState({
    select: (s) => {
      if (typeof document !== "undefined") {
        return document.title || s.location.pathname
      }
      return s.location.pathname
    },
  })

  const [live, setLive] = useState("")
  const prev = useRef("")

  useEffect(() => {
    if (announcement && announcement !== prev.current) {
      prev.current = announcement
      setLive("")
      requestAnimationFrame(() => setLive(announcement))
    }
  }, [announcement])

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {live}
    </div>
  )
}
