import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useState, type FormEvent, type ReactNode } from "react"
import { IconSafe } from "@/design/icons"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { DeliverToPicker } from "@/components/shell/DeliverToPicker"
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

/** Secondary / info links — not mixed into the cart cluster */
const UTILITY_NAV = [
  { label: "About Us", to: "/about", match: (p: string) => p === "/about" },
] as const

/**
 * Traditional commerce header:
 *
 *   [Logo]  [======== Search ========]  [Account] [Cart]
 *
 * Mobile: logo + account/cart on row 1; full-width search row 2.
 * About / Last Offers live in a slim utility strip (desktop)
 * and the menu drawer (mobile) — never between search and cart.
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


  function onSearch(e: FormEvent) {
    e.preventDefault()
    void navigate({ to: "/search", search: { q: q.trim() } })
  }

  const utilityLinkClass = (active: boolean) =>
    cn(
      "inline-flex min-h-9 items-center px-2.5 text-sm font-medium transition",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      active
        ? "font-semibold text-foreground"
        : "text-muted-foreground hover:text-foreground",
    )

  return (
    <header className="border-b border-border bg-card" role="banner">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        {/* Primary commerce row: Logo · Search · Account · Cart */}
        <div className="flex h-14 items-center gap-3 sm:h-16 sm:gap-4">
          <BrandLogo size="md" className="min-w-0 shrink-0" />

          {/* Where it is going changes what is worth showing, so the area sits
              before search rather than buried in checkout. */}
          <DeliverToPicker />

          {/* Search — center flex (md+). Traditional marketplace pattern. */}
          <form
            onSubmit={onSearch}
            className="relative hidden min-w-0 flex-1 md:block"
            role="search"
            aria-label="Site search"
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products"
              className={cn(
                "h-11 min-h-11 w-full rounded-full border border-border bg-muted/50",
                "py-2 pl-5 pr-24 text-sm text-foreground outline-none",
                "placeholder:text-muted-foreground",
                "focus:border-primary focus:bg-card focus-visible:ring-2 focus-visible:ring-primary/30",
              )}
              aria-label="Search products"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button
              type="submit"
              className={cn(
                "absolute right-1 top-1 inline-flex h-9 min-h-9 min-w-[4.25rem] items-center justify-center",
                "rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground",
                "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              Search
            </button>
          </form>

          {/* Desktop utility navigation next to search */}
          <nav
            className="hidden items-center gap-1.5 lg:flex shrink-0"
            aria-label="About and contact"
          >
            {UTILITY_NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={utilityLinkClass(active)}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Trailing tools — far right, always Account then Cart (commerce convention) */}
          <div
            className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1"
            role="group"
            aria-label="Account and cart"
          >
            {/* Mobile: utility menu (About) — left of account */}
            <div className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-11 min-h-11 min-w-11 items-center justify-center rounded-full",
                    "text-muted-foreground hover:bg-muted hover:text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label="More menu"
                >
                  <IconSafe name="menu" size={22} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[12rem]" aria-label="Site links">
                {UTILITY_NAV.map((item) =>
                  "hash" in item && item.hash ? (
                    <DropdownMenuItem asChild key={item.label}>
                      <a href={`/#${item.hash}`}>{item.label}</a>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem asChild key={item.label}>
                      <Link to={item.to}>{item.label}</Link>
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            </div>

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
          className="relative pb-3 md:hidden"
          role="search"
          aria-label="Site search"
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className={cn(
              "h-11 min-h-11 w-full rounded-full border border-border bg-muted/50",
              "py-2 pl-5 pr-24 text-sm text-foreground outline-none",
              "placeholder:text-muted-foreground",
              "focus:border-primary focus:bg-card focus-visible:ring-2 focus-visible:ring-primary/30",
            )}
            aria-label="Search products"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button
            type="submit"
            className={cn(
              "absolute right-1 top-1 inline-flex h-9 min-h-9 min-w-[4.25rem] items-center justify-center",
              "rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            Search
          </button>
        </form>

      </div>
    </header>
  )
}
