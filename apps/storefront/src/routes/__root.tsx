import {
  Link,
  Outlet,
  createRootRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { retrieveCart } from "@/lib/cart"
import { getSessionCustomer } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { SiteFooter } from "@/components/site-footer"
import { DocumentTitle } from "@/components/document-title"
import { ScrollToTop } from "@/components/scroll-to-top"
import { NotFoundPage } from "@/components/not-found"
import { trackPageview } from "@/lib/analytics"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { IconCart, IconSearch } from "@/components/icons"
import { LanguageSelect } from "@/components/language-select"

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

/** SPA pageviews — path only, no query strings with emails/tokens. */
function AnalyticsPageviews() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    trackPageview(pathname)
  }, [pathname])
  return null
}

function Shell() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [q, setQ] = useState("")
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  const cartQ = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
  })
  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })

  const count =
    cartQ.data?.items.reduce((s, l) => s + l.quantity, 0) ?? 0

  const isAuthPage = pathname.startsWith("/signin")
  const hideBottom =
    pathname.startsWith("/checkout") ||
    isAuthPage ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/product/")

  useEffect(() => {
    setAccountOpen(false)
  }, [pathname])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    void navigate({
      to: "/search",
      search: { q: q.trim() },
    })
  }

  const shopActive =
    pathname.startsWith("/browse") || pathname.startsWith("/product/")
  const sellersActive =
    pathname.startsWith("/sellers") || pathname.startsWith("/store/")

  const initials = sessionQ.data
    ? (
        sessionQ.data.firstName?.[0] ||
        sessionQ.data.email[0] ||
        "A"
      ).toUpperCase()
    : null

  // Full-bleed auth: no constrained main, no footer chrome
  if (isAuthPage) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
        >
          Skip to content
        </a>
        <main id="main" className="flex min-h-screen flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background">
        {/* Main bar: logo · search · actions — Walmart-style square search */}
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:py-3">
          <Link
            to="/"
            className="shrink-0 text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            alkemart
            <span className="text-primary">.</span>
          </Link>

          <form
            onSubmit={submitSearch}
            className="relative hidden min-w-0 flex-1 md:block"
          >
            <IconSearch
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="h-11 w-full border border-border bg-background py-2 pl-10 pr-[5.5rem] text-sm outline-none transition placeholder:text-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground"
              aria-label="Search products"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 h-11 border border-l-0 border-border bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Search
            </button>
          </form>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <LanguageSelect compact />
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                className={cn(
                  "inline-flex h-10 items-center gap-2 px-2 text-sm font-medium transition hover:bg-muted sm:px-2.5",
                  pathname.startsWith("/account") ||
                    pathname.startsWith("/orders")
                    ? "bg-muted"
                    : "",
                )}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                onClick={() => setAccountOpen((v) => !v)}
              >
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-foreground text-[11px] text-background">
                    {initials ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">
                  {sessionQ.data ? "Account" : "Sign in"}
                </span>
              </button>

              {accountOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-56 overflow-hidden border border-border bg-card py-1 shadow-md"
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
                      <MenuLink
                        to="/account"
                        onNavigate={() => setAccountOpen(false)}
                      >
                        Profile &amp; addresses
                      </MenuLink>
                      <MenuLink
                        to="/orders"
                        onNavigate={() => setAccountOpen(false)}
                      >
                        Orders
                      </MenuLink>
                    </>
                  ) : (
                    <>
                      <MenuLink
                        to="/signin"
                        search={{}}
                        onNavigate={() => setAccountOpen(false)}
                      >
                        Sign in
                      </MenuLink>
                      <MenuLink
                        to="/signin"
                        search={{}}
                        onNavigate={() => setAccountOpen(false)}
                      >
                        Create account
                      </MenuLink>
                      <MenuLink
                        to="/orders"
                        onNavigate={() => setAccountOpen(false)}
                      >
                        Find an order
                      </MenuLink>
                    </>
                  )}
                  <div className="border-t border-border">
                    <MenuLink
                      to="/help"
                      onNavigate={() => setAccountOpen(false)}
                    >
                      Help
                    </MenuLink>
                  </div>
                </div>
              ) : null}
            </div>

            <Link
              to="/cart"
              className={cn(
                "relative inline-flex h-10 items-center gap-2 px-2 text-sm font-medium transition hover:bg-muted sm:px-2.5",
                pathname.startsWith("/cart") || pathname.startsWith("/checkout")
                  ? "bg-muted"
                  : "",
              )}
            >
              <IconCart aria-hidden />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        {/* Mobile search — square */}
        <div className="border-t border-border px-4 py-2 md:hidden">
          <form onSubmit={submitSearch} className="flex">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="h-10 min-h-10 flex-1 border border-border bg-background px-3 text-sm outline-none focus:border-foreground focus:ring-1 focus:ring-foreground"
              aria-label="Search products"
            />
            <button
              type="submit"
              className="h-10 shrink-0 border border-l-0 border-border bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Search
            </button>
          </form>
        </div>

        <nav
          className="hidden border-t border-border md:block"
          aria-label="Shop"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-0 px-4">
            <NavText to="/" active={pathname === "/"} label="Home" />
            <NavText
              to="/browse/$slug"
              params={{ slug: "all" }}
              active={shopActive}
              label="Departments"
            />
            <NavText
              to="/sellers"
              active={sellersActive}
              label="Sellers"
            />
          </div>
        </nav>
      </header>

      <main
        id="main"
        className={cn(
          "mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:py-6",
          !hideBottom && "pb-24 md:pb-8",
          pathname === "/" && "pt-4 sm:pt-5",
        )}
      >
        <Outlet />
      </main>

      <div className={cn(!hideBottom && "pb-16 md:pb-0")}>
        <SiteFooter />
      </div>

      {!hideBottom ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background md:hidden"
          aria-label="Mobile primary"
        >
          <div className="mx-auto grid max-w-6xl grid-cols-4 gap-0 px-1 py-1">
            <BottomLink to="/" label="Home" active={pathname === "/"} />
            <BottomLink
              to="/browse/$slug"
              params={{ slug: "all" }}
              label="Shop"
              active={pathname.startsWith("/browse")}
            />
            <BottomLink
              to="/cart"
              label={count > 0 ? `Cart (${count})` : "Cart"}
              active={pathname.startsWith("/cart")}
            />
            <BottomLink
              to={sessionQ.data ? "/account" : "/signin"}
              search={sessionQ.data ? undefined : {}}
              label="Account"
              active={
                pathname.startsWith("/account") ||
                pathname.startsWith("/signin") ||
                pathname.startsWith("/orders")
              }
            />
          </div>
        </nav>
      ) : null}
    </div>
  )
}

function NavText(props: {
  to: string
  params?: Record<string, string>
  active?: boolean
  label: string
}) {
  return (
    <Link
      to={props.to as "/"}
      params={props.params as never}
      className={cn(
        "border-b-2 px-3 py-2.5 text-sm font-medium transition",
        props.active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {props.label}
    </Link>
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

function BottomLink(props: {
  to: string
  params?: Record<string, string>
  search?: Record<string, string | undefined>
  label: string
  active?: boolean
}) {
  return (
    <Link
      to={props.to as "/"}
      params={props.params as never}
      search={props.search as never}
      className={cn(
        "flex min-h-11 flex-col items-center justify-center px-1 text-center text-[11px] font-semibold",
        props.active ? "bg-muted text-foreground" : "text-muted-foreground",
      )}
    >
      {props.label}
    </Link>
  )
}
