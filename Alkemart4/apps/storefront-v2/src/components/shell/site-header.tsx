import { Link, useNavigate, useRouterState } from "@tanstack/react-router"
import { useEffect, useState } from "react"
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

/** Home uses a rounded gold top bar on phones and an ink header on desktop. */
const ON_INK = "lg:group-data-[tone=hero]/header:text-white lg:group-data-[tone=hero]/header:hover:bg-white/10"
const NAV_LINK = cn(
  "inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold hover:bg-foreground/5 data-[status=active]:bg-foreground/5",
  ON_INK,
)

/** Phone routes that get the header search row: browsing and buying, not managing. */
const SHOPPING_ROUTES = ["/categories", "/browse", "/shops", "/store/", "/product/"]

function phoneSearch(pathname: string) {
  return SHOPPING_ROUTES.some((r) => pathname.startsWith(r))
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hero = pathname === "/"
  const [scrolledPastHero, setPastHero] = useState(false)
  // Only meaningful on the home page; elsewhere it's simply false (no reset needed).
  const pastHero = hero && scrolledPastHero
  useEffect(() => {
    if (!hero) return
    const sync = () => {
      const section = document.getElementById("home-hero")
      setPastHero(Boolean(section && section.getBoundingClientRect().bottom <= 64))
    }
    sync()
    window.addEventListener("scroll", sync, { passive: true })
    window.addEventListener("resize", sync)
    return () => { window.removeEventListener("scroll", sync); window.removeEventListener("resize", sync) }
  }, [hero])
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
          ? cn("rounded-b-xl transition-colors motion-reduce:transition-none lg:rounded-none lg:bg-ink lg:on-ink", pastHero ? "bg-background shadow-sm" : "bg-brand")
          : "border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      )}
    >
      <div className="container-page flex h-16 items-center gap-3 md:h-[72px] lg:gap-5">
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
      {/* Phones: search sits where people shop. Home has its own in the hero;
          account, saved, cart, sign-in and help pages don't need one. */}
      {phoneSearch(pathname) ? (
        <div className="container-page pb-3 md:hidden">
          <SearchBox placeholder="Search products or stores" />
        </div>
      ) : null}
    </header>
  )
}
