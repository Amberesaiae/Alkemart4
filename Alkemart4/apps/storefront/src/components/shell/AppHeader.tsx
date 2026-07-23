import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useRef, useState, useEffect, type FormEvent, type ReactNode } from "react"
import { IconSafe } from "@/design/icons"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type AppHeaderProps = {
  cartCount: number
  userInitials: string | null
  userLabel: string
  isAccountActive: boolean
  accountMenu: ReactNode
  accountOpen: boolean
  onAccountToggle: () => void
  onAccountClose: () => void
}

/** Secondary / info links — not mixed into the cart cluster */
const UTILITY_NAV = [
  { label: "About Us", to: "/about", match: (p: string) => p === "/about" },
  {
    label: "Contact Us",
    to: "/contact",
    match: (p: string) => p === "/contact",
  },
] as const

/**
 * Traditional commerce header:
 *
 *   [Logo]  [======== Search ========]  [Account] [Cart]
 *
 * Mobile: logo + account/cart on row 1; full-width search row 2.
 * About / Last Offers / Contact live in a slim utility strip (desktop)
 * and the menu drawer (mobile) — never between search and cart.
 */
export function AppHeader({
  cartCount,
  userInitials,
  userLabel,
  isAccountActive,
  accountMenu,
  accountOpen,
  onAccountToggle,
  onAccountClose,
}: AppHeaderProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [q, setQ] = useState("")
  const accountRef = useRef<HTMLDivElement>(null)
  const accountBtnRef = useRef<HTMLButtonElement>(null)
  const menuDetailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) onAccountClose()
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [onAccountClose])

  useEffect(() => {
    if (!accountOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onAccountClose()
        accountBtnRef.current?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [accountOpen, onAccountClose])

  useEffect(() => {
    const el = menuDetailsRef.current
    if (el) el.open = false
  }, [pathname])

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
            {/* Mobile: utility menu (About / Contact) — left of account */}
            <details ref={menuDetailsRef} className="relative lg:hidden">
              <summary
                className={cn(
                  "flex h-11 min-h-11 min-w-11 list-none cursor-pointer items-center justify-center rounded-full",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
                )}
                aria-label="More menu"
              >
                <IconSafe name="menu" size={22} />
              </summary>
              <div
                className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded-2xl border border-border bg-card p-1.5 shadow-lg"
                role="navigation"
                aria-label="Site links"
              >
                {UTILITY_NAV.map((item) =>
                  "hash" in item && item.hash ? (
                    <a
                      key={item.label}
                      href={`/#${item.hash}`}
                      className="flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            </details>

            {/* Account */}
            <div className="relative" ref={accountRef}>
              <button
                ref={accountBtnRef}
                type="button"
                id="account-menu-button"
                className={cn(
                  "inline-flex h-11 min-h-11 min-w-11 flex-col items-center justify-center gap-0 rounded-full px-2",
                  "text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "sm:min-w-[3.25rem] sm:px-2.5",
                  (isAccountActive || accountOpen) && "bg-muted text-foreground",
                )}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-controls="account-menu"
                aria-label={userLabel}
                onClick={onAccountToggle}
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
              {accountOpen ? accountMenu : null}
            </div>

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
