import { useEffect, useRef } from "react"
import { useRouterState } from "@tanstack/react-router"

/**
 * Restores scroll on real navigations — and only on real navigations.
 *
 * It used to fire on every pathname *or* search change, which meant narrowing
 * a filter or switching category yanked the buyer back to the top of the
 * document, away from the control they had just used. On a listing page that
 * reads as the page fighting you.
 *
 * The rule now: scrolling belongs to a change of *place*, not a change of
 * *query*. Staying on the same route and refining it — /categories/men to
 * /categories/women, or applying a facet — keeps your position. Moving to a
 * different route scrolls to the top, as a new page should.
 */
export function ScrollToTop() {
  const routeId = useRouterState({
    select: (s) => s.matches[s.matches.length - 1]?.routeId ?? s.location.pathname,
  })
  const previous = useRef<string | null>(null)

  useEffect(() => {
    // First paint is already at the top; scrolling again would fight any
    // browser-restored position on a reload.
    if (previous.current !== null && previous.current !== routeId) {
      window.scrollTo(0, 0)
    }
    previous.current = routeId
  }, [routeId])

  return null
}
