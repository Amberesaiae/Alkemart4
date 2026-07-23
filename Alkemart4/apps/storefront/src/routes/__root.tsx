import {
  Link,
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router"
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { retrieveCart } from "@/lib/cart"
import { getSessionCustomer } from "@/lib/auth"
import { listStoreCategories } from "@/lib/products"
import { resolveRailCategories } from "@/lib/catalog-nav"
import { getMercurVendorUrl } from "@/lib/env"
import { cn } from "@/lib/utils"
import { AppHeader } from "@/components/shell/AppHeader"
import { AppFooter } from "@/components/shell/AppFooter"
import { CategoryIconRail } from "@/components/shell/CategoryIconRail"
import { DocumentTitle } from "@/components/document-title"
import { RouteAnnouncer } from "@/components/a11y/RouteAnnouncer"
import { ScrollToTop } from "@/components/scroll-to-top"
import { SearchMicroHeader } from "@/components/search/SearchMicroHeader"
import { NotFoundPage } from "@/components/not-found"
import { trackPageview } from "@/lib/analytics"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      /** Avoid thrash / UI glitches on remount and back-navigation */
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
})

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <DocumentTitle />
      <RouteAnnouncer />
      <ScrollToTop />
      <AnalyticsPageviews />
      <Shell />
    </QueryClientProvider>
  )
}

function AnalyticsPageviews() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    trackPageview(pathname)
  }, [pathname])
  return null
}

/**
 * Full-bleed marketplace shell (canonical storefront layout).
 * Header + department rail + main + footer span the viewport.
 * Content max-width lives on the content row only — not a nested “page card”
 * (that pattern made the real site look tiny / cut off inside another frame).
 */
function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [accountOpen, setAccountOpen] = useState(false)
  /** Defer cart/session until after first paint so home JS + catalog win the network. */
  const [shellReady, setShellReady] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setShellReady(true), 0)
    return () => window.clearTimeout(t)
  }, [])

  const cartQ = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
    enabled: shellReady,
    staleTime: 30_000,
  })
  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
    enabled: shellReady,
    staleTime: 60_000,
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })

  /** Department rail — real API categories only */
  const railCategories = useMemo(
    () => resolveRailCategories(catsQ.data ?? []),
    [catsQ.data],
  )

  const count =
    cartQ.data?.items.reduce((s, l) => s + l.quantity, 0) ?? 0

  const isAuthPage = pathname.startsWith("/login")
  const isSearchPage = pathname === "/search" || pathname.startsWith("/search?")
  const isCheckout = pathname.startsWith("/checkout")

  /**
   * Category rail — discovery chrome only.
   * Hide on auth, checkout, cart, product (focus commerce steps).
   */
  const showCategoryRail =
    !isAuthPage &&
    !isCheckout &&
    !pathname.startsWith("/cart") &&
    !pathname.startsWith("/product/")

  /** Active department slug when browsing; undefined on home (no rail item selected). */
  const browseActiveSlug = (() => {
    if (!pathname.startsWith("/categories/") && !pathname.startsWith("/browse/"))
      return undefined
    const slug = pathname
      .replace(/^\/(categories|browse)\//, "")
      .split("/")[0]
    if (!slug || slug === "all") return undefined
    return slug
  })()

  const initials = sessionQ.data
    ? (
        sessionQ.data.firstName?.[0] ||
        sessionQ.data.email[0] ||
        "A"
      ).toUpperCase()
    : null

  const closeAccount = useCallback(() => setAccountOpen(false), [])

  useEffect(() => {
    setAccountOpen(false)
  }, [pathname])

  // Escape closes account menu (WCAG 2.1.1 Keyboard)
  useEffect(() => {
    if (!accountOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [accountOpen])

  let sellUrl = ""
  try {
    sellUrl = getMercurVendorUrl()
  } catch {
    /* optional */
  }

  if (isAuthPage || isSearchPage) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground"
        >
          Skip to content
        </a>
        {isSearchPage ? (
          <div className="flex min-h-screen flex-col bg-[#febf31]">
            <SearchMicroHeader />
            <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
              <Outlet />
            </main>
          </div>
        ) : (
          <main id="main" tabIndex={-1} className="flex min-h-screen flex-1 flex-col outline-none">
            <Outlet />
          </main>
        )}
      </div>
    )
  }

  const accountMenu = (
    <div
      id="account-menu"
      role="menu"
      aria-label="Account menu"
      className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-2xl border border-border bg-card py-1 shadow-lg"
    >
      {sessionQ.data ? (
        <>
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold">
              {[sessionQ.data.firstName, sessionQ.data.lastName]
                .filter(Boolean)
                .join(" ") || "Account"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {sessionQ.data.email}
            </p>
          </div>
          <MenuLink to="/account" onNavigate={closeAccount}>
            Profile &amp; addresses
          </MenuLink>
          <MenuLink to="/orders" onNavigate={closeAccount}>
            Orders
          </MenuLink>
        </>
      ) : (
        <>
          <div className="space-y-2 border-b border-border p-3">
            <Link
              to="/login"
              search={{ mode: "login" }}
              role="menuitem"
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-4 text-sm font-bold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={closeAccount}
            >
              Sign in
            </Link>
            <Link
              to="/login"
              search={{ mode: "register" }}
              role="menuitem"
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={closeAccount}
            >
              Create account
            </Link>
          </div>
          <MenuLink to="/orders" onNavigate={closeAccount}>
            Find an order
          </MenuLink>
        </>
      )}
      <div className="border-t border-border">
        <MenuLink to="/help" onNavigate={closeAccount}>
          Help
        </MenuLink>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <AppHeader
        cartCount={count}
        userInitials={initials}
        userLabel={sessionQ.data ? "Account" : "Sign in"}
        isAccountActive={
          pathname.startsWith("/account") || pathname.startsWith("/orders")
        }
        accountOpen={accountOpen}
        onAccountToggle={() => setAccountOpen((v) => !v)}
        onAccountClose={closeAccount}
        accountMenu={accountMenu}
      />

      {showCategoryRail ? (
        <CategoryIconRail
          categories={railCategories}
          activeSlug={browseActiveSlug}
        />
      ) : null}

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-[1200px] flex-1 px-4 py-5 pb-8 outline-none sm:px-6 sm:py-6 sm:pb-10",
          isCheckout && "max-w-5xl",
        )}
      >
        <Outlet />
      </main>

      {/* Full-bleed footer — no top border/gap so no light hairline above dark bar */}
      <div className="w-full shrink-0">
        <AppFooter sellUrl={sellUrl} />
      </div>
    </div>
  )
}

function MenuLink(props: {
  to: string
  search?: Record<string, string | undefined>
  onNavigate: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      to={props.to as "/"}
      search={props.search as never}
      role="menuitem"
      className="block min-h-11 px-4 py-2.5 text-sm text-foreground hover:bg-muted focus-visible:bg-muted"
      onClick={props.onNavigate}
    >
      {props.children}
    </Link>
  )
}
