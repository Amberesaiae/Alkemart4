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
import { ScrollToTop } from "@/components/scroll-to-top"
import { NotFoundPage } from "@/components/not-found"
import { trackPageview } from "@/lib/analytics"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
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

  const cartQ = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
  })
  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
  })

  /** Department rail — real API categories only */
  const railCategories = useMemo(
    () => resolveRailCategories(catsQ.data ?? []),
    [catsQ.data],
  )

  const count =
    cartQ.data?.items.reduce((s, l) => s + l.quantity, 0) ?? 0

  const isAuthPage = pathname.startsWith("/login")
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

  let sellUrl = ""
  try {
    sellUrl = getMercurVendorUrl()
  } catch {
    /* optional */
  }

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main id="main" className="flex min-h-screen flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    )
  }

  const accountMenu = (
    <div
      role="menu"
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
          <MenuLink
            to="/login"
            search={{ mode: "login" }}
            onNavigate={closeAccount}
          >
            Sign in
          </MenuLink>
          <MenuLink
            to="/login"
            search={{ mode: "register" }}
            onNavigate={closeAccount}
          >
            Create account
          </MenuLink>
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
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
        className={cn(
          "mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 pb-10 sm:px-6 sm:py-8 sm:pb-12",
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
      className="block px-4 py-2.5 text-sm text-foreground hover:bg-muted"
      onClick={props.onNavigate}
    >
      {props.children}
    </Link>
  )
}
