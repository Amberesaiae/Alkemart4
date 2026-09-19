import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  TooltipProvider,
} from "@workspace/ui"
import { Toaster } from "sonner"
import { AppHeader } from "@/components/shell/AppHeader"
import { AppFooter } from "@/components/shell/AppFooter"
import { CategoryIconRail } from "@/components/shell/CategoryIconRail"
import { retrieveCart } from "@/lib/cart"
import { getSessionCustomer, logout } from "@/lib/auth"
import { listStoreCategories } from "@/lib/products"
import { resolveRailCategories } from "@/lib/catalog-nav"
import { getVendorAppUrl } from "@/lib/env"
import { brand } from "@/design/brand"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
})

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Shell />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

function Shell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [accountOpen, setAccountOpen] = useState(false)

  const cartQ = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
    staleTime: 30_000,
  })
  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
    staleTime: 60_000,
  })
  const catsQ = useQuery({
    queryKey: ["store", "categories"],
    queryFn: () => listStoreCategories(),
    staleTime: 5 * 60_000,
  })

  const railCategories = useMemo(
    () => resolveRailCategories(catsQ.data ?? []),
    [catsQ.data],
  )

  const count = cartQ.data?.items.reduce((s, l) => s + l.quantity, 0) ?? 0
  const me = sessionQ.data
  const userInitials = me?.email ? me.email.slice(0, 1).toUpperCase() : null
  const isAuthPage = pathname.startsWith("/login")
  const isCheckout = pathname.startsWith("/checkout")
  const hideRail = isAuthPage || isCheckout || pathname.startsWith("/cart") || pathname.startsWith("/product/")

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader
        cartCount={count}
        userInitials={userInitials}
        userLabel={me ? me.email : "Sign in"}
        isAccountActive={pathname.startsWith("/login")}
        accountOpen={accountOpen}
        onAccountOpenChange={setAccountOpen}
        accountMenu={
          <>
            <DropdownMenuLabel>{me ? me.email : "Account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {me ? (
              <>
                <DropdownMenuItem asChild>
                  <Link to="/cart">Purchases / cart</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void logout().then(() => {
                      void queryClient.invalidateQueries({ queryKey: ["store", "session"] })
                    })
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild>
                <Link to="/login">Sign in</Link>
              </DropdownMenuItem>
            )}
          </>
        }
      />
      {hideRail ? null : <CategoryIconRail categories={railCategories} />}
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      {isCheckout ? null : (
        <AppFooter categories={railCategories} sellUrl={getVendorAppUrl()} />
      )}
      <Toaster richColors position="top-center" />
      <p className="sr-only">{brand.tagline}</p>
    </div>
  )
}
