/**
 * Self-building facets: only shows attributes with count > 0 from the search API.
 */
import { cn } from "@/lib/utils"
import type { FacetDistribution } from "@/lib/search"

export type ActiveFilters = {
  category_handles: string[]
  seller_handles: string[]
}

type Props = {
  distribution: FacetDistribution
  active: ActiveFilters
  onChange: (next: ActiveFilters) => void
  className?: string
}

const LABELS: Record<string, string> = {
  category_handles: "Category",
  seller_handle: "Seller",
  has_offer: "Availability",
  currency_code: "Currency",
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value]
}

export function SearchFacets({
  distribution,
  active,
  onChange,
  className,
}: Props) {
  const groups = Object.entries(distribution).filter(
    ([, counts]) => counts && Object.keys(counts).length > 0,
  )

  if (!groups.length) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Filters appear when the catalog has facet data (after search sync).
      </p>
    )
  }

  const hasActive =
    active.category_handles.length > 0 || active.seller_handles.length > 0

  return (
    <aside className={cn("space-y-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Filters</h2>
        {hasActive ? (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() =>
              onChange({ category_handles: [], seller_handles: [] })
            }
          >
            Clear all
          </button>
        ) : null}
      </div>

      {groups.map(([attr, counts]) => {
        // Prefer primary facet groups for UX
        if (attr !== "category_handles" && attr !== "seller_handle") {
          return null
        }
        const label = LABELS[attr] ?? attr
        const entries = Object.entries(counts)
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

        if (!entries.length) return null

        return (
          <div key={attr} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </h3>
            <ul className="space-y-1.5">
              {entries.map(([value, count]) => {
                const selected =
                  attr === "category_handles"
                    ? active.category_handles.includes(value)
                    : active.seller_handles.includes(value)
                return (
                  <li key={value}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border accent-primary"
                        checked={selected}
                        onChange={() => {
                          if (attr === "category_handles") {
                            onChange({
                              ...active,
                              category_handles: toggle(
                                active.category_handles,
                                value,
                              ),
                            })
                          } else {
                            onChange({
                              ...active,
                              seller_handles: toggle(
                                active.seller_handles,
                                value,
                              ),
                            })
                          }
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">{value}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {count}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </aside>
  )
}
