import { useEffect } from "react"
import { Outlet, createRootRouteWithContext, useRouterState } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SiteHeader } from "@/components/shell/site-header"
import { SiteFooter } from "@/components/shell/site-footer"
import { MobileTabBar } from "@/components/shell/mobile-tab-bar"
import { NotFound } from "@/components/feedback/not-found"
import { trackPageview } from "@/lib/analytics"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

/** Announces route changes to screen readers and tracks pageviews. */
function RouteEffects() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    trackPageview(pathname)
    const t = window.setTimeout(() => {
      const el = document.getElementById("route-announcer")
      if (el) el.textContent = document.title
    }, 100)
    return () => window.clearTimeout(t)
  }, [pathname])
  return null
}

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Sign-in and checkout are focused flows: no footer or tab bar.
  const focused = pathname.startsWith("/login") || pathname.startsWith("/checkout")
  return (
    <TooltipProvider delayDuration={200}>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div id="route-announcer" aria-live="polite" className="sr-only" />
      <RouteEffects />
      <div className={`flex min-h-dvh flex-col ${pathname === "/" ? "mobile-home-preserved" : ""}`}>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none md:pb-0">
          <Outlet />
        </main>
        {!focused ? <SiteFooter /> : null}
      </div>
      {!focused ? <div className={pathname === "/" ? "mobile-home-preserved" : undefined}><MobileTabBar /></div> : null}
      <Toaster position="top-center" />
    </TooltipProvider>
  )
}
