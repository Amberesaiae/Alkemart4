import { IconSafe } from "@/design/icons"
import { Breadcrumbs, type Crumb } from "@/components/shell/Breadcrumbs"
import type { ListingSort } from "@/components/listing/ListingFacets"
import { cn } from "@/lib/utils"
import { useId, type ReactNode } from "react"

export type ListingViewMode = "grid" | "list"

type Props = {
  title: string
  count?: number
  loadingCount?: boolean
  crumbs?: Crumb[]
  breadcrumbLabel?: string
  /** Compact filter dropdown rendered at the top — the only filter surface. */
  filterDropdown?: ReactNode
  /** @deprecated hero image card omitted — kept for call-site compat */
  hero?: ReactNode
  /** @deprecated big filter bar omitted — kept for call-site compat */
  filterStrip?: ReactNode
  /** Removable applied-facet chips, shown directly above the grid. */
  applied?: ReactNode
  /** Category sidebar — Category + Sub-category + Sellers. Desktop only. */
  sidebar?: ReactNode
  /** @deprecated category rail omitted — kept for call-site compat */
  toolbar?: ReactNode
  children: ReactNode
  /** @deprecated no sidebar to toggle — kept for call-site compat */
  filtersOpen?: boolean
  onToggleFilters?: () => void
  activeFilterCount?: number
  sort?: ListingSort
  onSortChange?: (sort: ListingSort) => void
  viewMode?: ListingViewMode
  onViewModeChange?: (mode: ListingViewMode) => void
  className?: string
}

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "title", label: "Name A–Z" },
]

/**
 * Foundational PLP chrome (MOWAFER reference):
 * title · count · top bar (Filters dropdown on mobile + Sort + view) ·
 * 2-column body (sidebar on lg+, grid content).
 * No hero image card, no category rail, no big filter bar.
 * Sidebar + mobile dropdown share one URL-owned ListingFacetState — no
 * duplicate writers.
 */
export function ListingLayout({
  title,
  count,
  loadingCount,
  crumbs,
  breadcrumbLabel,
  filterDropdown,
  applied,
  sidebar,
  children,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  className,
}: Props) {
  const trail: Crumb[] =
    crumbs ??
    [
      { label: "Home", to: "/" },
      { label: breadcrumbLabel ?? title },
    ]

  const showSort = typeof sort === "string" && typeof onSortChange === "function"
  const showView =
    typeof viewMode === "string" && typeof onViewModeChange === "function"
  const sortId = useId()

  return (
    <div className={cn("space-y-5", className)}>
      <Breadcrumbs items={trail} />

      <div className="space-y-1">
        <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        <p className="type-sm text-muted-foreground">
          {!loadingCount && typeof count === "number"
            ? `${count} product${count === 1 ? "" : "s"}`
            : "\u00a0"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterDropdown ? (
          <div className="lg:hidden">{filterDropdown}</div>
        ) : null}

        {showSort ? (
          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <label
              htmlFor={sortId}
              className="type-sm font-semibold text-muted-foreground"
            >
              Sort
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(e) => onSortChange(e.target.value as ListingSort)}
              className="bg-transparent type-sm font-semibold text-foreground outline-none"
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showView ? (
          <div
            className="ms-auto inline-flex shrink-0 overflow-hidden rounded-full border border-border bg-card"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              aria-pressed={viewMode === "grid"}
              aria-label="Grid view"
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "flex h-11 w-11 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <IconSafe name="filter-grid" size={18} />
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              aria-label="List view"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "flex h-11 w-11 items-center justify-center border-l border-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <IconSafe name="filter-list" size={18} preferAsset={false} />
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "grid gap-6",
          sidebar ? "lg:grid-cols-[240px_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {sidebar ? (
          <div className="hidden min-w-0 lg:block">{sidebar}</div>
        ) : null}
        <div className="min-w-0 space-y-4">
          {applied}
          {children}
        </div>
      </div>
    </div>
  )
}
