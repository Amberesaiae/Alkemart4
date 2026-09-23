import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useState, useEffect, type FormEvent, type ReactNode } from "react"
import { IconSafe } from "@/design/icons"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { DeliverToPicker } from "@/components/shell/DeliverToPicker"
import { HeaderCategoryDropdown } from "@/components/shell/HeaderCategoryDropdown"
import { HeaderCategoryNav } from "@/components/shell/HeaderCategoryNav"
import { SearchFilterDialog } from "@/components/shell/SearchFilterDialog"
import {
  SearchAutocompleteDropdown,
  saveStoredRecentSearch,
} from "@/components/shell/SearchAutocompleteDropdown"
import {
  Bicycle,
  MagnifyingGlass,
  ShoppingCartSimple,
  SlidersHorizontal,
  Storefront,
  User,
} from "@phosphor-icons/react"
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui"
import { cn } from "@/lib/utils"

export type AppHeaderProps = {
  cartCount: number
  userInitials: string | null
  userLabel: string
  isAccountActive: boolean
  accountMenu: ReactNode
  accountOpen: boolean
  onAccountOpenChange: (open: boolean) => void
  onAccountClose: () => void
}

/**
 * Modern commerce header matching Hubtel specification:
 *
 *   [Logo] [======== Search (Looking for? + Filter) ========] [Home] [Stores] [Sign in / Avatar] [Cart]
 *   [Departments Category Rail.........................................................................]
 */
export function AppHeader({
  cartCount,
  userInitials,
  userLabel,
  isAccountActive,
  accountMenu,
  accountOpen,
  onAccountOpenChange,
}: AppHeaderProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [q, setQ] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState(false)
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false)

  // Close dropdowns on route changes
  useEffect(() => {
    setDesktopDropdownOpen(false)
    setMobileDropdownOpen(false)
  }, [pathname])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const clean = q.trim()
    if (clean) {
      saveStoredRecentSearch(clean)
    }
    setDesktopDropdownOpen(false)
    setMobileDropdownOpen(false)
    void navigate({ to: "/search", search: { q: clean } })
  }

  const isHome = pathname === "/"

  return (
    <header className="relative z-30 border-b border-border bg-card shadow-xs" role="banner">
      {/* Top Utility Row / Yellow band above search */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex h-8 sm:h-9 w-full max-w-[1200px] items-center justify-between sm:justify-end gap-3 sm:gap-6 px-4 text-xs font-bold sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/sell" className="inline-flex items-center gap-1.5 transition hover:opacity-85 text-primary-foreground">
              <Storefront size={15} weight="duotone" />
              <span>Sell on alkemart</span>
            </Link>
            <Link to="/delivery" className="hidden xs:inline-flex items-center gap-1.5 transition hover:opacity-85 text-primary-foreground">
              <Bicycle size={15} weight="bold" />
              <span>Ride on alkemart</span>
            </Link>
          </div>
          <span className="rounded-lg bg-foreground text-background px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-black tracking-wider uppercase shadow-xs">
            GET THE APP
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        {/* Primary commerce row: Logo + Deliver to · Search (centered) · Nav (Home · Stores) · Sign in / Avatar · Cart */}
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 md:gap-5">
          {/* Left: Hamburger menu (non-home only) + Brand Logo + Deliver to (matching Hubtel reference) */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0 min-w-0">
            {!isHome && <HeaderCategoryDropdown pathname={pathname} />}
            <BrandLogo size="md" className="shrink-0" />
            <DeliverToPicker />
          </div>

          {/* Search — centered in middle matching Hubtel reference */}
          <div className="relative hidden md:flex flex-1 items-center justify-center max-w-[28rem] lg:max-w-[32rem] mx-2 lg:mx-auto">
            <form
              onSubmit={onSearch}
              className="w-full"
              role="search"
              aria-label="Site search"
            >
              <div className="relative min-w-0 w-full">
                <MagnifyingGlass
                  size={19}
                  weight="bold"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/80"
                />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setDesktopDropdownOpen(true)
                  }}
                  onFocus={() => setDesktopDropdownOpen(true)}
                  placeholder="Looking for?"
                  className={cn(
                    "h-11 w-full rounded-xl border border-border/80 bg-background/80 shadow-2xs",
                    "py-2 pl-10 pr-11 text-sm font-medium text-foreground outline-none",
                    "placeholder:text-muted-foreground/75",
                    "focus:border-primary focus:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-all",
                  )}
                  aria-label="Search products"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors"
                  aria-label="Open search filters"
                >
                  <SlidersHorizontal size={18} weight="bold" />
                </button>
              </div>
            </form>

            <SearchAutocompleteDropdown
              isOpen={desktopDropdownOpen}
              query={q}
              onClose={() => setDesktopDropdownOpen(false)}
              onSelectQuery={(selected) => {
                setQ(selected)
                setDesktopDropdownOpen(false)
              }}
            />
          </div>

          {/* Navigation & Controls: Home · Stores · Sign in / Avatar · Cart shifted towards right */}
          <div
            className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2 ml-auto md:ml-0"
            role="navigation"
            aria-label="Header navigation"
          >
            {/* Desktop Home tab */}
            <Link
              to="/"
              className={cn(
                "hidden md:inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm transition-colors",
                isHome
                  ? "bg-muted text-foreground font-bold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-semibold",
              )}
            >
              Home
            </Link>

            {/* Desktop Stores tab */}
            <Link
              to="/shops"
              className={cn(
                "hidden md:inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm transition-colors",
                pathname.startsWith("/shops")
                  ? "bg-muted text-foreground font-bold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-semibold",
              )}
            >
              Stores
            </Link>

            {/* Sign in / User Avatar (Replaces Purchases & Account slot) */}
            <DropdownMenu open={accountOpen} onOpenChange={onAccountOpenChange}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  id="account-menu-button"
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl px-2.5 sm:px-3 text-sm font-semibold transition-colors",
                    "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    (isAccountActive || accountOpen) && "bg-muted text-foreground font-bold",
                  )}
                  aria-label={userLabel}
                >
                  <Avatar className="size-7 sm:size-7.5 border border-border shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-bold",
                        userInitials
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {userInitials ? (
                        userInitials
                      ) : (
                        <span aria-hidden="true">
                          <User size={15} weight="bold" />
                        </span>
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:inline text-xs sm:text-sm font-semibold">
                    {userInitials ? "Account" : "Sign in"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" aria-label="Account menu">
                {accountMenu}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cart (Replaces Purchases & Account slot) */}
            <Link
              to="/cart"
              className={cn(
                "relative inline-flex h-10 items-center gap-2 rounded-xl px-2.5 sm:px-3 text-sm font-semibold transition-colors",
                "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pathname.startsWith("/cart") && "bg-muted text-foreground font-bold",
              )}
              aria-label={
                cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"
              }
            >
              <span className="relative inline-flex items-center shrink-0" aria-hidden="true">
                <ShoppingCartSimple size={21} weight="bold" />
                {cartCount > 0 ? (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center",
                      "rounded-full bg-primary px-1 text-[0.65rem] font-bold leading-none text-primary-foreground shadow-2xs",
                    )}
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </span>
              <span className="hidden lg:inline text-xs sm:text-sm font-semibold">
                Cart
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile search — full width under tools */}
        <div className="relative pb-3 md:hidden">
          <form
            onSubmit={onSearch}
            className="flex items-center gap-2"
            role="search"
            aria-label="Site search"
          >
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass
                size={19}
                weight="bold"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/80"
              />
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setMobileDropdownOpen(true)
                }}
                onFocus={() => setMobileDropdownOpen(true)}
                placeholder="Looking for?"
                className={cn(
                  "h-10 min-h-10 w-full rounded-xl border border-border/80 bg-background/80 shadow-2xs",
                  "py-2 pl-10 pr-11 text-sm font-medium text-foreground outline-none",
                  "placeholder:text-muted-foreground/75",
                  "focus:border-primary focus:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-all",
                )}
                aria-label="Search products"
                autoComplete="off"
                enterKeyHint="search"
              />
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted transition-colors"
                aria-label="Open search filters"
              >
                <SlidersHorizontal size={18} weight="bold" />
              </button>
            </div>
          </form>

          <SearchAutocompleteDropdown
            isOpen={mobileDropdownOpen}
            query={q}
            onClose={() => setMobileDropdownOpen(false)}
            onSelectQuery={(selected) => {
              setQ(selected)
              setMobileDropdownOpen(false)
            }}
          />
        </div>

        {/* Full-width, horizontally scrollable taxonomy row (Home page only) */}
        {isHome && (
          <div className="flex h-10 sm:h-11 items-center">
            <HeaderCategoryNav pathname={pathname} />
          </div>
        )}
      </div>

      <SearchFilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        initialQuery={q}
      />
    </header>
  )
}
