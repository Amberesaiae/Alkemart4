import { Link, useRouterState } from "@tanstack/react-router"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  FavouriteIcon,
  Home01Icon,
  Store04Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { useSavedItems } from "@/lib/wishlist"
import { cn } from "@/lib/utils"

const TABS: { to: string; label: string; icon: IconSvgElement; match: (p: string) => boolean }[] = [
  { to: "/", label: "Home", icon: Home01Icon, match: (p) => p === "/" },
  { to: "/categories", label: "Explore", icon: DashboardSquare01Icon, match: (p) => p.startsWith("/categories") || p.startsWith("/search") },
  { to: "/shops", label: "Stores", icon: Store04Icon, match: (p) => p.startsWith("/shops") },
  { to: "/saved", label: "Saved", icon: FavouriteIcon, match: (p) => p.startsWith("/saved") },
  { to: "/account", label: "Account", icon: UserIcon, match: (p) => p.startsWith("/account") || p.startsWith("/orders") || p.startsWith("/login") },
]

/** Phone navigation. Hidden on pages that own the bottom edge (PDP buy bar, checkout). */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const saved = useSavedItems().items.length
  if (pathname.startsWith("/product/") || pathname.startsWith("/checkout") || pathname.startsWith("/cart")) {
    return null
  }
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname)
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-brand")}>
                  <HugeiconsIcon icon={t.icon} className="size-5" />
                </span>
                {t.label}
                {t.to === "/saved" && saved > 0 ? (
                  <span className="absolute top-1.5 right-[calc(50%-18px)] size-2 rounded-full bg-deal" aria-hidden />
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
