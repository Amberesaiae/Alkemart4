import { Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState, useEffect, type FormEvent } from "react"
import { IconSafe } from "@/design/icons"
import { BrandLogo } from "@/components/shell/BrandLogo"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export type AppHeaderProps = {
  cartCount: number
  userInitials: string | null
  userLabel: string
  isAccountActive: boolean
  accountMenu: React.ReactNode
  accountOpen: boolean
  onAccountToggle: () => void
  onAccountClose: () => void
}

/**
 * Storefront header — chrome only:
 *   [BrandLogo] [search] [account] [cart]
 *
 * No language switcher. No Home / Last Offers / Help text links
 * (those live in category rail, footer, and in-page CTAs).
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
  const [q, setQ] = useState("")
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) onAccountClose()
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [onAccountClose])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    void navigate({ to: "/search", search: { q: q.trim() } })
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-[68px] w-full max-w-[1200px] items-center gap-3 px-4 sm:h-[72px] sm:gap-4 sm:px-6">
        <BrandLogo size="md" className="min-w-0" />

        <form onSubmit={onSearch} className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <IconSafe name="search" size={18} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products and compare prices"
            className="h-11 w-full rounded-full border border-border bg-muted/60 py-2 pl-10 pr-[5.75rem] text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/25"
            aria-label="Search products"
          />
          <button
            type="submit"
            className="absolute right-1 top-1 flex h-9 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            Search
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-0.5">
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-2 text-sm font-medium transition hover:bg-muted",
                isAccountActive || accountOpen ? "bg-muted" : "",
              )}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              aria-label={userLabel}
              onClick={onAccountToggle}
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback
                  className={cn(
                    "text-[11px]",
                    userInitials
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {userInitials ? (
                    userInitials
                  ) : (
                    <IconSafe name="user" size={16} />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[5.5rem] truncate sm:inline">
                {userLabel}
              </span>
            </button>
            {accountOpen ? accountMenu : null}
          </div>

          <Link
            to="/cart"
            className="relative inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-medium transition hover:bg-muted sm:px-2.5"
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
          >
            <IconSafe name="cart" size={22} />
            <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground sm:static sm:ml-0">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  )
}
