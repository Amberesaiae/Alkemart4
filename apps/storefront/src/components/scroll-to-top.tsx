import { useEffect } from "react"
import { useRouterState } from "@tanstack/react-router"

export function ScrollToTop() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.searchStr })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search])

  return null
}
