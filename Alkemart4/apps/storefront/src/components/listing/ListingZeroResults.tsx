import { appliedFacets, type ListingFacetState } from "./ListingFacets"
import { Button } from "@workspace/ui"

/**
 * A zero-result page that names the culprit.
 *
 * "No products. Try another department or clear filters" puts the work on the
 * buyer: they have to guess which of five filters emptied the page. Every
 * applied facet is listed with a one-click removal, so recovering is a choice
 * rather than a puzzle — and "clear everything" stays available for the buyer
 * who would rather start over.
 *
 * Deliberately not counting results-per-relaxation yet: that needs one count
 * query per applied facet, and promising "14 results" that turns out wrong is
 * worse than not promising. The removal buttons work regardless.
 */
export function ListingZeroResults({
  state,
  onChange,
  onClearAll,
  lookup,
}: {
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  onClearAll: () => void
  lookup?: {
    sellerName?: (handle: string) => string
    subCategoryLabel?: (id: string) => string
    attributeLabel?: (code: string) => string
  }
}) {
  const applied = appliedFacets(state, lookup ?? {})

  if (applied.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
        <p className="text-base font-bold text-foreground">Nothing here yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No seller has listed in this category so far.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-6">
      <p className="text-base font-bold text-foreground">
        No products match all {applied.length} filters
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Remove one to widen the search:
      </p>
      <ul className="mt-4 space-y-2">
        {applied.map((facet) => (
          <li key={facet.key}>
            <button
              type="button"
              onClick={() => onChange(facet.clear(state))}
              className="group flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-start text-sm hover:border-primary"
            >
              <span className="text-muted-foreground">Without</span>
              <span className="font-bold text-foreground">
                {facet.group}: {facet.label}
              </span>
              <span className="ms-auto text-xs font-bold text-primary opacity-0 group-hover:opacity-100">
                Remove
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" onClick={onClearAll} className="mt-4 w-full">
        Clear all filters
      </Button>
    </div>
  )
}
