import { IconSafe } from "@/design/icons"
import { Breadcrumbs, type Crumb } from "@/components/shell/Breadcrumbs"
import type { ListingSort } from "@/components/listing/ListingFilters"
import { cn } from "@/lib/utils"
import { useId, type ReactNode } from "react"

export type ListingViewMode = "grid" | "list"

type Props = {
  title: string
  count?: number
  loadingCount?: boolean
  crumbs?: Crumb[]
  breadcrumbLabel?: string
  hero?: ReactNode
  filterStrip?: ReactNode
  sidebar: ReactNode
  toolbar?: ReactNode
  children: ReactNode
  filtersOpen: boolean
  onToggleFilters: () => void
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
 * PLP chrome: count · Filters | Featured sort as chip grid · View right
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
  filtersOpen,
  onToggleFilters,
  activeFilterCount = 0,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
  className,
}: Props) {
  const panelId = useId()
  const trail: Crumb[] =
    crumbs ??
    [
      { label: "Home", to: "/" },
      { label: breadcrumbLabel ?? title },
    ]

  const showSort = typeof sort === "string" && typeof onSortChange === "function"
  const showView =
    typeof viewMode === "string" && typeof onViewModeChange === "function"

  return (
    <div className={cn("space-y-5", className)}>
      <Breadcrumbs items={trail} />

      {hero}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="type-sm text-muted-foreground">
            {!loadingCount && typeof count === "number"
              ? `${count} product${count === 1 ? "" : "s"}`
              : "\u00a0"}
          </p>
          <button
            type="button"
            className={cn(
              "ms-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 type-sm font-semibold transition",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              filtersOpen && "border-primary/40 bg-primary/5",
            )}
            aria-expanded={filtersOpen}
            aria-controls={panelId}
            onClick={onToggleFilters}
          >
            <span className="inline-flex items-center gap-1.5">
              {filtersOpen ? "Hide filters" : "Filters"}
              {activeFilterCount > 0 ? (
                <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-primary-foreground">
                  {activeFilterCount}
                  <span className="sr-only">
                    {" "}
                    active filter{activeFilterCount === 1 ? "" : "s"}
                  </span>
                </span>
              ) : null}
            </span>
            <IconSafe
              name="chevron-right"
              size={16}
              preferAsset={false}
              className={cn(
                "shrink-0 transition-transform duration-200",
                filtersOpen ? "rotate-90" : "rotate-0",
              )}
            />
          </button>
        </div>

        {/* Featured/sort as chip grid (left) · view toggles (right) */}
        {showSort || showView ? (
          <div className="flex items-start gap-2 sm:items-center">
            {showSort ? (
              <div
                className="min-w-0 flex-1"
                role="group"
                aria-label="Sort products"
              >
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {SORT_OPTIONS.map((opt) => {
                    const on = sort === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onSortChange(opt.value)}
                        className={cn(
                          "min-h-10 rounded-full border px-2.5 py-2 text-center type-sm font-semibold transition",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
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
        ) : null}
      </div>

      {toolbar}

      <div
        id={panelId}
        hidden={!filtersOpen}
        className={cn("space-y-4", !filtersOpen && "hidden")}
      >
        {filterStrip}
      </div>

      <div
        className={cn(
          "grid gap-6",
          filtersOpen ? "lg:grid-cols-[240px_1fr]" : "grid-cols-1",
        )}
      >
        {filtersOpen ? (
          <div className="min-w-0" aria-labelledby={panelId}>
            {sidebar}
          </div>
        ) : null}
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  )
}
