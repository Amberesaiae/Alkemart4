import { Breadcrumbs, type Crumb } from "@/components/shell/Breadcrumbs"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export type ListingViewMode = "grid" | "list"

type Props = {
  title: string
  count?: number
  loadingCount?: boolean
  crumbs?: Crumb[]
  breadcrumbLabel?: string
  /** PLP hero (imgi_11/12) */
  hero?: ReactNode
  /** Horizontal filter strip under hero */
  filterStrip?: ReactNode
  sidebar: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  mobileFiltersOpen: boolean
  onToggleMobileFilters: () => void
  className?: string
}

/**
 * Mowafer PLP chrome (imgi_11/12):
 * breadcrumb → hero → filter strip → sidebar | main
 * View toggle lives in ListingFilterStrip (not duplicated here).
 */
export function ListingLayout({
  title,
  count,
  loadingCount,
  crumbs,
  breadcrumbLabel,
  hero,
  filterStrip,
  sidebar,
  toolbar,
  children,
  mobileFiltersOpen,
  onToggleMobileFilters,
  className,
}: Props) {
  const trail: Crumb[] =
    crumbs ??
    [
      { label: "Home", to: "/" },
      { label: breadcrumbLabel ?? title },
    ]

  return (
    <div className={cn("space-y-5", className)}>
      <Breadcrumbs items={trail} />

      {hero}

      {filterStrip}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-sm text-muted-foreground">
          {!loadingCount && typeof count === "number"
            ? `${count} product${count === 1 ? "" : "s"}`
            : "\u00a0"}
        </p>
        <button
          type="button"
          className="rounded-full border border-border bg-card px-4 py-2 type-sm font-semibold lg:hidden"
          onClick={onToggleMobileFilters}
        >
          {mobileFiltersOpen ? "Hide filters" : "Filters & sort"}
        </button>
      </div>

      {toolbar}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className={cn("lg:block", mobileFiltersOpen ? "block" : "hidden")}>
          {sidebar}
        </div>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  )
}
