import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  FavouriteIcon,
  Logout01Icon,
  PackageIcon,
  ShoppingCart01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BrandLogo } from "@/components/brand/brand-logo"
import { SearchBox } from "@/components/shell/search-box"
import { CategoryMenu } from "@/components/shell/category-menu"
import { DeliverToPicker } from "@/components/shell/deliver-to-picker"
import { useCartCount, useSession } from "@/hooks/use-store"
import { HOME_CHIP, useHomeSticky } from "@/lib/home-sticky"
import { logout } from "@/lib/auth"
import { getVendorAppUrl } from "@/lib/env"
import { cn } from "@/lib/utils"

function CartButton() {
  const count = useCartCount()
  return (
    <Button asChild variant="ghost" size="icon-lg" className={cn("relative hover:bg-foreground/5", ON_INK)}>
      <Link to="/cart" aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}>
        <HugeiconsIcon icon={ShoppingCart01Icon} className="size-6" />
        {count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[length:var(--text-legacy-11)] font-bold text-brand-foreground tabular ring-2 ring-background">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}

function AccountMenu() {
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = session.data
  if (!me) {
    return (
      <Button asChild variant="ghost" className={cn("hidden h-10 gap-2 hover:bg-foreground/5 md:inline-flex", ON_INK)}>
        <Link to="/login">
          <HugeiconsIcon icon={UserIcon} className="size-5" />
          Sign in
        </Link>
      </Button>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("hidden h-10 gap-2 hover:bg-foreground/5 md:inline-flex", ON_INK)}>
          <HugeiconsIcon icon={UserIcon} className="size-5" />
          Account
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{me.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <HugeiconsIcon icon={UserIcon} /> Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/orders">
            <HugeiconsIcon icon={PackageIcon} /> Orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/saved">
            <HugeiconsIcon icon={FavouriteIcon} /> Saved
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout()
            await queryClient.invalidateQueries({ queryKey: ["store"] })
            void navigate({ to: "/" })
          }}
        >
          <HugeiconsIcon icon={Logout01Icon} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** On the home page the header joins the hero: gold on phones, ink on desktop. */
const ON_INK = "lg:group-data-[tone=hero]/header:text-white lg:group-data-[tone=hero]/header:hover:bg-white/10"
const NAV_LINK = cn(
  "inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold hover:bg-foreground/5 data-[status=active]:bg-foreground/5",
  ON_INK,
)

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onSearch = pathname === "/search"
  const hero = pathname === "/"
  const sticky = useHomeSticky()
  // Phone home, hero search scrolled away: search and departments take over.
  const compact = hero && sticky.stuck
  // Checkout is a focused flow: no search, menus or cart to wander off to.
  // The page's own "‹ Cart · Secure checkout" row handles the way back.
  if (pathname.startsWith("/checkout")) {
    return (
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="container-page flex h-14 items-center md:h-16">
          <BrandLogo size="md" className="shrink-0" />
        </div>
      </header>
    )
  }
  return (
    <header
      data-tone={hero ? "hero" : "default"}
      className={cn(
        "group/header sticky top-0 z-40",
        hero
          ? "bg-brand lg:bg-ink lg:on-ink"
          : "border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      )}
    >
      <div inert={compact} className="container-page flex h-16 items-center gap-3 md:h-[72px] lg:gap-5">
        <BrandLogo size="md" hero={hero} className="shrink-0" />
        <DeliverToPicker className={cn("hidden xl:inline-flex", ON_INK)} />
        <SearchBox className={cn("hidden max-w-2xl flex-1 md:block", hero && "[&_input]:border-transparent [&_input]:bg-background")} />
        <nav aria-label="Primary" className="hidden items-center lg:flex">
          <CategoryMenu />
          <Link to="/shops" className={NAV_LINK}>
            Stores
          </Link>
          <a href={getVendorAppUrl()} className={NAV_LINK}>
            Sell on alkemart
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <DeliverToPicker compact className="hover:bg-foreground/5 md:hidden" />
          <AccountMenu />
          <CartButton />
        </div>
      </div>
      {compact ? (
        // Overlays the row it replaces instead of resizing the header, so the
        // page below never jumps when it appears.
        <div className="absolute inset-x-0 top-0 bg-brand shadow-sm md:hidden">
          <div className="container-page flex items-center gap-1 pt-2">
            <SearchBox placeholder="Search products or stores" className="min-w-0 flex-1 [&_input]:h-11 [&_input]:border-transparent [&_input]:bg-background" />
            <CartButton />
          </div>
          <nav aria-label="Departments" className="flex gap-2 overflow-x-auto px-4 pt-2 pb-2 [scrollbar-width:none]">
            {sticky.chips.map((c) => (
              <Link
                key={c.slug}
                to="/categories/$slug"
                params={{ slug: c.slug }}
                className={HOME_CHIP}
              >
                {c.label}
              </Link>
            ))}
            <Link to="/categories" className={HOME_CHIP}>
              All
            </Link>
          </nav>
        </div>
      ) : null}
      {/* Home has the hero search; a second box directly above it is clutter. */}
      {!onSearch && !hero ? (
        <div className="container-page pb-3 md:hidden">
          <SearchBox placeholder="Search products or stores" />
        </div>
      ) : null}
    </header>
  )
}
