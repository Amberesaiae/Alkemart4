import { Link, useRouterState } from "@tanstack/react-router"
import { House, MagnifyingGlass, Tag, User } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

/**
 * Offers tab destination: `/search?deals=1` (documented in src/design/SPINE.md).
 */
const TABS = [
  { id: "home", label: "Home", to: "/" as const, search: undefined, Icon: House, match: (p: string) => p === "/" },
  {
    id: "offers",
    label: "Offers",
    to: "/search" as const,
    search: { deals: "1" },
    Icon: Tag,
    match: (p: string, search: string) => p === "/search" && search.includes("deals="),
  },
  {
    id: "search",
    label: "Search",
    to: "/search" as const,
    search: {},
    Icon: MagnifyingGlass,
    match: (p: string, search: string) => p === "/search" && !search.includes("deals="),
  },
  {
    id: "account",
    label: "Account",
    to: "/login" as const,
    search: undefined,
    Icon: User,
    match: (p: string) => p.startsWith("/login"),
  },
] as const

export function BottomTabBar({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.searchStr })

  return (
    <nav
      aria-label="Mobile tabs"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-[1200px] grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname, search)
          return (
            <li key={tab.id}>
              <Link
                to={tab.to}
                search={tab.search}
                data-testid={`tab-${tab.id}`}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <tab.Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
