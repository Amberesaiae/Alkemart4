import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchCatalogFacets } from "@/lib/catalog-facets"
import { toggleAttributeFacet, type ListingFacetState } from "./ListingFacets"
import { orderFacets, prunedValues } from "./facet-quality"
import { cn } from "@/lib/utils"

/**
 * Definition-backed attribute filters — the "8 GB RAM / Lenovo" narrowing.
 *
 * Every group and every count comes from `GET /store/catalog/facets`, which
 * reads typed `product_attribute_values`, never the free-form
 * `products.attributes` JSON. Counts are the server's: a count computed from
 * the current page would contradict itself as soon as results paginate.
 *
 * Renders nothing when a category has no published attribute definitions.
 * An empty filter panel is honest; a panel of controls that match everything
 * is not.
 */
export function ListingAttributeFacets({
  categorySlug,
  state,
  onChange,
  className,
}: {
  categorySlug: string
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  className?: string
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const toggleExpanded = (code: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  const { data } = useQuery({
    queryKey: ["store", "catalog", "facets", categorySlug],
    queryFn: ({ signal }) => fetchCatalogFacets(categorySlug, signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  // Highest-signal first, single-value facets dropped: a filter that cannot
  // change the result set is a control that does nothing.
  const groups = orderFacets(
    data?.attributes ?? [],
    state.attributes,
    data?.availabilityCount,
  )

  // 40 brands is a scroll, not a filter. Cap, and let the buyer open it.
  const VALUE_CAP = 8
  const rows = (values: Record<string, number>, selected: readonly string[]) =>
    prunedValues(values, selected)
  const visibleValues = (
    code: string,
    values: Record<string, number>,
    selected: readonly string[],
  ) => {
    const all = rows(values, selected)
    return expanded.has(code) ? all : all.slice(0, VALUE_CAP)
  }
  const hiddenCount = (
    code: string,
    values: Record<string, number>,
    selected: readonly string[],
  ) => (expanded.has(code) ? 0 : Math.max(0, rows(values, selected).length - VALUE_CAP))

  if (groups.length === 0) return null

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group) => {
        const selected = state.attributes[group.code] ?? []
        return (
          <fieldset key={group.code} className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </legend>
            <ul className="space-y-0.5">
              {visibleValues(group.code, group.values, selected).map(([value, count]) => {
                  const on = selected.includes(value)
                return (
                    <li key={value}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs",
                          "hover:bg-current/10",
                          on && "font-bold",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            onChange(toggleAttributeFacet(state, group.code, value))
                          }
                          className="size-3.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate">{value}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      </label>
                    </li>
                )
              })}
              {hiddenCount(group.code, group.values, selected) > 0 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(group.code)}
                    className="px-1.5 py-1 text-xs font-bold text-primary hover:underline"
                  >
                    {expanded.has(group.code)
                      ? "Show less"
                      : `Show ${hiddenCount(group.code, group.values, selected)} more`}
                  </button>
                </li>
              ) : null}
            </ul>
          </fieldset>
        )
      })}
    </div>
  )
}
