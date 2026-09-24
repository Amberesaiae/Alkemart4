import { useQuery } from "@tanstack/react-query"
import { CaretDown } from "@phosphor-icons/react"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@workspace/ui"
import { fetchCatalogFacets } from "@/lib/catalog-facets"
import { orderFacets, prunedValues } from "./facet-quality"
import { toggleAttributeFacet, type ListingFacetState } from "./ListingFacets"
import { cn } from "@/lib/utils"

/**
 * The highest-signal facets, inline on the listing bar.
 *
 * The sidebar holds the full set; this is the short reach. Filters are the
 * primary tool on a listing page, so the two or three that most usefully split
 * the current results sit beside the sort control rather than behind a click.
 *
 * Renders nothing when no facet can narrow the result set — a control that
 * cannot change anything is worse than absent.
 */
const BAR_LIMIT = 3

export function ListingFacetBar({
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
  const { data } = useQuery({
    queryKey: ["store", "catalog", "facets", categorySlug],
    queryFn: ({ signal }) => fetchCatalogFacets(categorySlug, signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const groups = orderFacets(
    data?.attributes ?? [],
    state.attributes,
    data?.availabilityCount,
  ).slice(0, BAR_LIMIT)

  if (groups.length === 0) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {groups.map((group) => {
        const selected = state.attributes[group.code] ?? []
        const rows = prunedValues(group.values, selected)
        return (
          <Popover key={group.code}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold",
                  // Gold is an accent, never a surface (SPINE rule 10) — the
                  // selected state reads from the border and weight, not a wash.
                  selected.length > 0
                    ? "border-primary bg-muted text-foreground"
                    : "border-border/80 bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {group.label}
                {selected.length > 0 ? (
                  <span className="tabular-nums">({selected.length})</span>
                ) : null}
                <CaretDown size={12} weight="bold" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1.5">
              <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                {rows.map(([value, count]) => {
                  const on = selected.includes(value)
                  return (
                    <li key={value}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted",
                          on && "font-bold",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => onChange(toggleAttributeFacet(state, group.code, value))}
                          className="size-3.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate">{value}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}
