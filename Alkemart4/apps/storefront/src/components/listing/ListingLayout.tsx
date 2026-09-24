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
  /** Top category rail with visual thumbnails (Jumia-style) */
  categoryRail?: ReactNode
  /** Compact filter dropdown rendered at the top — the only filter surface. */
  filterDropdown?: ReactNode
  /** @deprecated hero image card omitted — kept for call-site compat */
  hero?: ReactNode
  /** @deprecated big filter bar omitted — kept for call-site compat */
  filterStrip?: ReactNode
  /** Removable applied-facet chips, shown directly above the grid. */
  applied?: ReactNode
  /** Quick filter types rendered directly inside the header card (Jumia pattern) */
  quickFilters?: ReactNode
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
  recentlyViewed?: ReactNode
  themeClass?: string
  className?: string
}

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: "featured", label: "Popularity" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "title", label: "Product Name A–Z" },
]

/**
 * Standard, refined retail PLP layout (Jumia visual hierarchy):
 * - Breadcrumbs
 * - Top Category Visual Rail (photos + labels)
 * - 2-Column body:
 *   - Structured Filter Sidebar on the left (lg+)
 *   - Right Content area with:
 *     - Crisp header bar card (Title + Result count + Sort dropdown + View toggle)
 *     - Removable applied filter chips
 *     - Product grid / list
 *     - Pagination & Load more
 * - Recently Viewed carousel at the bottom
 */
export function ListingLayout({
  title,
  count,
  loadingCount,
  crumbs,
  breadcrumbLabel,
  categoryRail,
  filterDropdown,
  applied,
  quickFilters,
  sidebar,
  children,
  sort,
  onSortChange,
  viewMode: _viewMode,
  onViewModeChange: _onViewModeChange,
  recentlyViewed,
  themeClass,
  className,
}: Props) {
  const trail: Crumb[] =
    crumbs ??
    [
      { label: "Home", to: "/" },
      { label: breadcrumbLabel ?? title },
    ]

  const showSort = typeof sort === "string" && typeof onSortChange === "function"
  const sortId = useId()

  return (
    <div className={cn("space-y-4 pb-8", themeClass, className)}>
      <Breadcrumbs items={trail} />

      {categoryRail}

      {/* Main 2-Column Catalog Container */}
      <div
        className={cn(
          "grid items-start gap-4 lg:gap-5",
          sidebar ? "lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {sidebar ? (
          <aside className="hidden min-w-0 lg:block">{sidebar}</aside>
        ) : null}

        <div className="min-w-0 space-y-3 sm:space-y-3.5">
          {/* Main Content Header Card — clean standard geometry, no over-roundedness */}
          <div className="rounded-md border border-border/80 bg-card px-4 py-3 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <h1 className="text-base font-bold text-foreground sm:text-lg">
                  {title}
                </h1>
                <span className="text-xs font-normal text-muted-foreground sm:text-sm">
                  {!loadingCount && typeof count === "number"
                    ? `(${count.toLocaleString()} ${count === 1 ? "result" : "results"})`
                    : ""}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {filterDropdown ? (
                  <div className="lg:hidden">{filterDropdown}</div>
                ) : null}

                {showSort ? (
                  <div className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs text-muted-foreground sm:text-sm">
                    <label htmlFor={sortId} className="shrink-0 font-medium">
                      Sort by:
                    </label>
                    <select
                      id={sortId}
                      value={sort}
                      onChange={(e) => onSortChange(e.target.value as ListingSort)}
                      className="cursor-pointer bg-transparent font-semibold text-foreground outline-none"
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
              </div>
            </div>

            {/* Applied filters live INSIDE the bar, under the title and sort.
                Below the card they read as page content; here they are visibly
                part of the control that produced them, and the result count
                sits directly above so the buyer can connect the two. */}
            {applied ? (
              <div className="mt-2.5 border-t border-border/60 pt-2.5">{applied}</div>
            ) : null}
          </div>

          {children}
        </div>
      </div>

      {recentlyViewed ? (
        <div className="w-full pt-4">{recentlyViewed}</div>
      ) : null}
    </div>
  )
}
