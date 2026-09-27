import { useState } from "react"
import { cn } from "cn"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Menu01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@workspace/console-ui/components/sheet"

export type ConsoleNavItem = {
  to: string
  label: string
  icon: IconSvgElement
  /** Count that needs action (e.g. orders to pack). Announced with the label. */
  badge?: number
  /** Screen-reader wording for the badge, e.g. "to pack". */
  badgeLabel?: string
}

export type ConsoleNavGroup = { label?: string; items: ConsoleNavItem[] }

/**
 * Router-agnostic link: the app passes its router's Link so this kit never
 * imports a router. Must forward className, aria-current and children.
 */
export type RenderLink = (p: {
  to: string
  className: string
  "aria-current"?: "page"
  children: React.ReactNode
}) => React.ReactNode

function Badge({ n, label }: { n: number; label?: string }) {
  if (!n) return null
  return (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground tabular">
      {n > 99 ? "99+" : n}
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  )
}

function NavGroups({
  groups,
  isActive,
  renderLink,
}: {
  groups: ConsoleNavGroup[]
  isActive: (to: string) => boolean
  renderLink: RenderLink
}) {
  return (
    <>
          {groups.map((g, i) => (
        <div key={g.label ?? i}>
          {g.label ? (
            <p className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">{g.label}</p>
          ) : null}
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(it.to)
              return (
                <li key={it.to}>
                  {renderLink({
                    to: it.to,
                    "aria-current": active ? "page" : undefined,
                    className: cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                      active
                        ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ),
                    children: (
                      <>
                        <HugeiconsIcon icon={it.icon} className="size-5 shrink-0" aria-hidden />
                        <span className="truncate">{it.label}</span>
                        <Badge n={it.badge ?? 0} label={it.badgeLabel} />
                      </>
                    ),
                  })}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

/**
 * Console layout: ink sidebar (≥lg), a top bar, the page, and — for the
 * seller app — a bottom tab bar on phones. One `<main id="main">` target
 * for the skip link.
 */
export function ConsoleShell({
  brand,
  identity,
  groups,
  isActive,
  renderLink,
  sidebarFooter,
  topBar,
  tabBar,
  children,
}: {
  brand: React.ReactNode
  /** Who's signed in / which shop — top of the sidebar. */
  identity?: React.ReactNode
  groups: ConsoleNavGroup[]
  isActive: (to: string) => boolean
  renderLink: RenderLink
  sidebarFooter?: React.ReactNode
  /** Right side of the top bar (account menu, search…). */
  topBar?: React.ReactNode
  /** Phone bottom tabs (seller app). Omit for desktop-first apps. */
  tabBar?: ConsoleNavItem[]
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-background px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside
        data-sidebar="sidebar"
        aria-label="Sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex print:hidden"
      >
        <div className="flex h-16 items-center px-5">{brand}</div>
        {identity ? <div className="px-3 pb-3">{identity}</div> : null}
        <nav aria-label="Main" className="scroll-quiet flex-1 space-y-5 overflow-y-auto px-3 py-2">
          <NavGroups groups={groups} isActive={isActive} renderLink={renderLink} />
        </nav>
        {sidebarFooter ? <div className="border-t border-sidebar-border p-3">{sidebarFooter}</div> : null}
      </aside>

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:h-16 sm:px-6 print:hidden">
          {!tabBar ? (
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-lg" className="lg:hidden" aria-label="Open menu">
                  <HugeiconsIcon icon={Menu01Icon} className="size-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" data-sidebar="sidebar" className="w-72 gap-0 border-0 bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="flex h-16 items-center px-5">{brand}</div>
                {/* Any link click closes the sheet. */}
                <nav aria-label="Main" className="scroll-quiet space-y-5 overflow-y-auto px-3 py-2" onClick={(e) => (e.target as HTMLElement).closest("a") && setMenuOpen(false)}>
                  <NavGroups groups={groups} isActive={isActive} renderLink={renderLink} />
                </nav>
              </SheetContent>
            </Sheet>
          ) : null}
          <div className="lg:hidden">{brand}</div>
          <div className="ml-auto flex items-center gap-2">{topBar}</div>
        </header>
        <main id="main" tabIndex={-1} className={cn("mx-auto w-full max-w-6xl px-4 py-5 outline-none sm:px-6 sm:py-8", tabBar && "pb-28 lg:pb-8")}>
          {children}
        </main>
      </div>

      {tabBar ? (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-safe lg:hidden print:hidden">
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabBar.length}, minmax(0, 1fr))` }}>
            {tabBar.map((it) => {
              const active = isActive(it.to)
              return (
                <li key={it.to}>
                  {renderLink({
                    to: it.to,
                    "aria-current": active ? "page" : undefined,
                    className: "group flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                    children: (
                      <>
                        <span
                          className={cn(
                            "relative grid h-8 w-14 place-items-center rounded-full transition-colors",
                            active ? "bg-brand text-brand-foreground" : "text-muted-foreground group-hover:bg-muted",
                          )}
                        >
                          <HugeiconsIcon icon={it.icon} className="size-[22px]" aria-hidden />
                          {it.badge ? (
                            <span className="absolute -top-1 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-foreground px-1 text-xs font-bold text-background tabular">
                              {it.badge > 99 ? "99+" : it.badge}
                            </span>
                          ) : null}
                        </span>
                        <span className={active ? "font-semibold text-foreground" : "text-muted-foreground"}>
                          {it.label}
                          {it.badge ? <span className="sr-only">, {it.badge} {it.badgeLabel}</span> : null}
                        </span>
                      </>
                    ),
                  })}
                </li>
              )
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
