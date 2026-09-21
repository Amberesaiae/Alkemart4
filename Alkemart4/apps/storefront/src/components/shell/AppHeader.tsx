import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useState, type FormEvent, type ReactNode } from "react"
import { IconSafe } from "@/design/icons"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { DeliverToPicker } from "@/components/shell/DeliverToPicker"
import { HeaderCategoryNav } from "@/components/shell/HeaderCategoryNav"
import { DEFAULT_STORE_CATEGORIES } from "@/lib/products"
import { iconForCategory } from "@/lib/catalog-nav"
import {
  Avatar,
  AvatarFallback,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
 * MOWAFER-shaped commerce header:
 *
 *   [Logo] [Deliver to] [======== Search ========] [Account] [Cart]
 *   [Departments................................................] [Stores]
 *
 * Mobile: logo + account/cart; full-width search; taxonomy context row.
 * Delivery area sits in the primary row (compact) so eligibility and total
 * cost are visible before any product decision (blueprint Doc 03).
 */
export function AppHeader({
  cartCount,
  userInitials,
  userLabel,
  isAccountActive,
  accountMenu,
  accountOpen,
  onAccountOpenChange,
  onAccountClose,
}: AppHeaderProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [q, setQ] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)

  function onSearch(e: FormEvent) {
    e.preventDefault()
    void navigate({ to: "/search", search: { q: q.trim() } })
  }

  return (
    <header className="border-b border-border bg-card shadow-xs" role="banner">
      <div className="hidden bg-muted/40 md:block">
        <div className="mx-auto flex h-9 w-full max-w-[1200px] items-center justify-end gap-6 px-4 text-xs font-semibold text-muted-foreground sm:px-6">
          <Link to="/sell" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
            <IconSafe name="add-cart" size={15} />
            Sell on alkemart
          </Link>
          <Link to="/delivery" className="inline-flex items-center gap-1.5 transition hover:text-foreground">
            <IconSafe name="truck" size={15} />
            Delivery partners
          </Link>
          <span className="rounded-md bg-foreground px-3 py-1.5 font-bold text-background">
            Get the app
          </span>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        {/* Primary commerce row: Logo · Search · Account · Cart */}
        <div className="flex h-12 items-center gap-2.5 sm:h-14 sm:gap-3">
          <BrandLogo size="md" className="min-w-0 shrink-0" />

          <DeliverToPicker className="max-w-[7rem] sm:max-w-[9rem] md:max-w-[10.5rem]" />

          {/* Search — the dominant desktop commerce control. */}
          <form
            onSubmit={onSearch}
            className="mx-auto hidden min-w-0 max-w-[34rem] flex-1 items-center gap-2 md:flex"
            role="search"
            aria-label="Site search"
          >
            <div className="relative min-w-0 flex-1">
              <IconSafe
                name="search"
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products, shops and categories"
                className={cn(
                  "h-10 min-h-10 w-full rounded-lg border border-border bg-muted/50",
                  "py-2 pl-10 pr-11 text-sm font-medium text-foreground outline-none",
                  "placeholder:text-muted-foreground",
                  "focus:border-primary focus:bg-card focus-visible:ring-2 focus-visible:ring-primary/30",
                )}
                aria-label="Search products"
                autoComplete="off"
                enterKeyHint="search"
              />
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open search filters"
              >
                <IconSafe name="filter-grid" size={17} weight="bold" />
              </button>
            </div>
          </form>

          <nav className="hidden shrink-0 items-center gap-0.5 lg:flex" aria-label="Primary">
            <Link to="/" className="rounded-md px-2 py-2 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground">
              Home
            </Link>
            <Link to="/shops" className="rounded-md px-2 py-2 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground">
              Stores
            </Link>
          </nav>

          {/* Trailing tools — far right, always Account then Cart (commerce convention) */}
          <div
            className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1"
            role="group"
            aria-label="Account and cart"
          >
            {/* Account */}
            <DropdownMenu open={accountOpen} onOpenChange={onAccountOpenChange}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  id="account-menu-button"
                  className={cn(
                    "inline-flex h-11 min-h-11 min-w-11 flex-col items-center justify-center gap-0 rounded-full px-2",
                    "text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "sm:min-w-[3.25rem] sm:px-2.5",
                    (isAccountActive || accountOpen) && "bg-muted text-foreground",
                  )}
                  aria-label={userLabel}
                >
                  <Avatar className="h-7 w-7 border border-border sm:h-8 sm:w-8">
                    <AvatarFallback
                      className={cn(
                        "text-xs",
                        userInitials
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {userInitials ? (
                        userInitials
                      ) : (
                        <span aria-hidden="true">
                          <IconSafe name="user" size={16} />
                        </span>
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[4.5rem] truncate text-xs font-semibold leading-none sm:block">
                    {userInitials ? "Account" : "Sign in"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" aria-label="Account menu">
                {accountMenu}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Cart — rightmost, badge on icon (Amazon/Jumia pattern) */}
            <Link
              to="/cart"
              className={cn(
                "relative inline-flex h-11 min-h-11 min-w-11 flex-col items-center justify-center gap-0 rounded-full px-2",
                "text-muted-foreground transition hover:bg-muted hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "sm:min-w-[3.25rem] sm:px-2.5",
                pathname.startsWith("/cart") && "bg-muted text-foreground",
              )}
              aria-label={
                cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"
              }
            >
              <span className="relative inline-flex" aria-hidden="true">
                <IconSafe name="cart" size={22} />
                {cartCount > 0 ? (
                  <span
                    className={cn(
                      "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center",
                      "rounded-full bg-primary px-1 text-[0.65rem] font-bold leading-none text-primary-foreground",
                    )}
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </span>
              <span className="hidden text-xs font-semibold leading-none sm:block">
                Cart
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile search — full width under tools */}
        <form
          onSubmit={onSearch}
          className="flex items-center gap-2 pb-3 md:hidden"
          role="search"
          aria-label="Site search"
        >
          <div className="relative min-w-0 flex-1">
            <IconSafe
              name="search"
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, shops and categories"
              className={cn(
                "h-10 min-h-10 w-full rounded-lg border border-border bg-muted/50",
                "py-2 pl-10 pr-11 text-sm font-medium text-foreground outline-none",
                "placeholder:text-muted-foreground",
                "focus:border-primary focus:bg-card focus-visible:ring-2 focus-visible:ring-primary/30",
              )}
              aria-label="Search products"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open search filters"
            >
              <IconSafe name="filter-grid" size={17} weight="bold" />
            </button>
          </div>
        </form>

        {/* Full-width, horizontally scrollable taxonomy row. */}
        <div className="flex min-h-12 items-center">
          <HeaderCategoryNav pathname={pathname} />
        </div>
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6 text-left">
            <DialogTitle className="text-2xl font-black">Filter your search</DialogTitle>
            <DialogDescription>
              Search directly or choose a department to narrow the market.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 pb-6">
            <form onSubmit={(event) => { onSearch(event); setFilterOpen(false) }} className="relative">
              <IconSafe name="search" size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="What are you looking for?"
                className="h-12 w-full rounded-xl border border-border bg-muted/40 pl-11 pr-4 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
            </form>
            <div>
              <p className="mb-3 text-sm font-black">Shop by department</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEFAULT_STORE_CATEGORIES.filter((category) => !category.parentCategoryId).slice(0, 9).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setFilterOpen(false)
                      void navigate({
                        to: "/search",
                        search: { category: [category.handle || category.id] },
                      })
                    }}
                    className="flex min-h-12 items-center gap-2 rounded-xl border border-border px-3 text-left text-sm font-bold transition hover:border-primary hover:bg-muted"
                  >
                    <IconSafe name={iconForCategory(category.name, category.handle)} size={17} className="text-primary" />
                    <span className="line-clamp-2">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  )
}
