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
import { useCallback, useEffect, useState } from "react"
import { retrieveCart } from "@/lib/cart"
import { getSessionCustomer } from "@/lib/auth"
import { getMercurVendorUrl } from "@/lib/env"
import { cn } from "@/lib/utils"
import { AppHeader } from "@/components/shell/AppHeader"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@workspace/ui"
import { AppFooter } from "@/components/shell/AppFooter"
import { DocumentTitle } from "@/components/document-title"
import { RouteAnnouncer } from "@/components/a11y/RouteAnnouncer"
import { SkipLink } from "@/components/skip-link"
import { ScrollToTop } from "@/components/scroll-to-top"
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
 * Header + main + footer span the viewport. Departments live in the
 * homepage mosaic and as an in-page reel on browse/search — not sticky chrome.
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
  const count =
    cartQ.data?.items.reduce((s, l) => s + l.quantity, 0) ?? 0

  const isAuthPage = pathname.startsWith("/login")
  const isCheckout = pathname.startsWith("/checkout")

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

  let sellUrl = ""
  try {
    sellUrl = getMercurVendorUrl()
  } catch {
    /* optional */
  }

  // Search keeps the standard site chrome — the bare gold micro-shell read as
  // a different app from the rest of the storefront.
  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SkipLink />
        <main id="main" tabIndex={-1} className="flex min-h-screen flex-1 flex-col outline-none">
          <Outlet />
        </main>
      </div>
    )
  }

  const accountMenu = (
    <>
      {sessionQ.data ? (
        <>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-semibold normal-case tracking-normal text-foreground">
              {[sessionQ.data.firstName, sessionQ.data.lastName]
                .filter(Boolean)
                .join(" ") || "Account"}
            </span>
            <span className="block truncate text-xs font-medium normal-case tracking-normal text-muted-foreground">
              {sessionQ.data.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <MenuLink to="/account" onNavigate={closeAccount}>
            Profile &amp; addresses
          </MenuLink>
          <MenuLink to="/orders" onNavigate={closeAccount}>
            Orders
          </MenuLink>
        </>
      ) : (
        <>
          <div className="space-y-2 p-2">
            <Link
              to="/login"
              search={{ mode: "login" }}
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-foreground px-4 text-sm font-bold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={closeAccount}
            >
              Sign in
            </Link>
            <Link
              to="/login"
              search={{ mode: "register" }}
              className="flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={closeAccount}
            >
              Create account
            </Link>
          </div>
          <DropdownMenuSeparator />
          <MenuLink to="/orders" onNavigate={closeAccount}>
            Find an order
          </MenuLink>
        </>
      )}
      <DropdownMenuSeparator />
      <MenuLink to="/help" onNavigate={closeAccount}>
        Help
      </MenuLink>
    </>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />

      <AppHeader
        cartCount={count}
        userInitials={initials}
        userLabel={sessionQ.data ? "Account" : "Sign in"}
        isAccountActive={
          pathname.startsWith("/account") || pathname.startsWith("/orders")
        }
        accountOpen={accountOpen}
        onAccountOpenChange={setAccountOpen}
        onAccountClose={closeAccount}
        accountMenu={accountMenu}
      />

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
    <DropdownMenuItem asChild onSelect={props.onNavigate}>
      <Link to={props.to as "/"} search={props.search as never}>
        {props.children}
      </Link>
    </DropdownMenuItem>
  )
}
