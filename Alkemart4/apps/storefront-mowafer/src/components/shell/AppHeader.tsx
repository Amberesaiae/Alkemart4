import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { MagnifyingGlass, ShoppingCart, User } from "@phosphor-icons/react"
import { useState, type FormEvent, type ReactNode } from "react"
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Input,
} from "@workspace/ui"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { cn } from "@/lib/utils"

export type AppHeaderProps = {
  cartCount: number
  userInitials: string | null
  userLabel: string
  isAccountActive: boolean
  accountMenu: ReactNode
  accountOpen: boolean
  onAccountOpenChange: (open: boolean) => void
}

const TEXT_NAV = [
  { label: "Home", to: "/" as const, match: (p: string) => p === "/" },
  { label: "Stores", to: "/shops" as const, match: (p: string) => p.startsWith("/shops") },
  { label: "Purchases", to: "/cart" as const, match: (p: string) => p.startsWith("/cart") },
] as const

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

  function onSearch(e: FormEvent) {
    e.preventDefault()
    void navigate({ to: "/search", search: { q: q.trim() || undefined } })
  }

  return (
    <header className="border-b border-border bg-card" role="banner">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
        <div className="flex h-14 items-center gap-3 sm:h-16 sm:gap-4">
          <BrandLogo size="md" className="min-w-0 shrink-0" />

          <form
            onSubmit={onSearch}
            className="relative hidden min-w-0 flex-1 md:block"
            role="search"
            aria-label="Site search"
          >
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find products with best price"
              className="h-11 rounded-full pr-12"
              aria-label="Find products with best price"
              autoComplete="off"
              enterKeyHint="search"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 size-9 rounded-full"
              aria-label="Search"
            >
              <MagnifyingGlass size={18} weight="bold" />
            </Button>
          </form>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {TEXT_NAV.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "inline-flex min-h-9 items-center px-2.5 text-sm font-medium transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div
            className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1"
            role="group"
            aria-label="Account and cart"
          >
            <DropdownMenu open={accountOpen} onOpenChange={onAccountOpenChange}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-11 min-h-11 min-w-11 flex-col rounded-full px-2 text-xs font-semibold leading-none",
                    (isAccountActive || accountOpen) && "bg-muted text-foreground",
                  )}
                  aria-label={userLabel}
                >
                  <Avatar className="h-7 w-7 border border-border sm:h-8 sm:w-8">
                    <AvatarFallback
                      className={cn(
                        "text-xs",
                        userInitials ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {userInitials ?? <User size={16} aria-hidden />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs font-semibold leading-none sm:block">
                    {userInitials ? "Account" : "Sign in"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" aria-label="Account menu">
                {accountMenu}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              to="/cart"
              className={cn(
                "relative inline-flex h-11 min-h-11 min-w-11 flex-col items-center justify-center rounded-full px-2",
                "text-muted-foreground transition hover:bg-muted hover:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring",
                pathname.startsWith("/cart") && "bg-muted text-foreground",
              )}
              aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
            >
              <span className="relative inline-flex" aria-hidden>
                <ShoppingCart size={22} />
                {cartCount > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-bold leading-none text-primary-foreground">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </span>
              <span className="hidden text-xs font-semibold leading-none sm:block">Cart</span>
            </Link>
          </div>
        </div>

        <form
          onSubmit={onSearch}
          className="relative pb-3 md:hidden"
          role="search"
          aria-label="Site search"
        >
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find products with best price"
            className="h-11 rounded-full pr-12"
            aria-label="Find products with best price"
            autoComplete="off"
            enterKeyHint="search"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1 size-9 rounded-full"
            aria-label="Search"
          >
            <MagnifyingGlass size={18} weight="bold" />
          </Button>
        </form>
      </div>
    </header>
  )
}
