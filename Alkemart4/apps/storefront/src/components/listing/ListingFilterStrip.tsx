/**
 * PLP facet strip.
 *
 * Reads and writes the same `ListingFacetState` as the sidebar — the
 * subcategory fieldset used to hold its own copy while the sidebar changed
 * routes for the same thing, so the two could disagree.
 *
 * Rating options carry live result counts and hide the buckets that would
 * return nothing; a facet that leads to an empty grid is worse than no
 * facet at all.
 */
import { ProductRating } from "@/components/product/ProductRating"
import type { ListingFacetState } from "@/components/listing/ListingFacets"
import {
  ListingLocationFilter,
  type LocationFilterValue,
} from "@/components/listing/ListingLocationFilter"
import { cn } from "@/lib/utils"

type Props = {
  departmentLabel: string
  /**
   * Real child categories of the current department. Empty when the
   * taxonomy is flat — the subcategory fieldset is omitted entirely then,
   * instead of showing a fake "All X / X" pair that filters nothing.
   */
  subCategories?: { id: string; label: string }[]
  /** How many products would remain at each minimum rating. */
  ratingCounts?: Record<number, number>
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  locationEnabled?: boolean
  className?: string
}

const RATING_OPTIONS = [5, 4, 3, 2, 1] as const

const chipBase = cn(
  "min-h-10 rounded-lg border px-3 py-2 type-sm font-medium transition",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
)
const chipOn = "facet-row-on border-transparent font-semibold"
const chipOff =
  "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"

export function ListingFilterStrip({
  departmentLabel,
  subCategories = [],
  ratingCounts,
  state,
  onChange,
  locationEnabled = false,
  className,
}: Props) {
  const ratingOptions = RATING_OPTIONS.filter(
    // Keep the current selection visible even if it now yields nothing,
    // otherwise the control vanishes under the user's own choice.
    (n) => !ratingCounts || (ratingCounts[n] ?? 0) > 0 || state.minRating === n,
  )

  return (
    <div
      className={cn(
        "listing-filter-strip grid gap-4 rounded-lg border border-border bg-card p-4",
        "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:items-start",
        className,
      )}
      role="region"
      aria-label="Listing filters"
    >
      {subCategories.length > 0 ? (
        <fieldset className="min-w-0 space-y-2">
          <legend className="type-sm font-semibold text-foreground">
            {departmentLabel}
          </legend>
          <div
            className="grid grid-cols-1 gap-1.5 xs:grid-cols-2 sm:grid-cols-1"
            role="radiogroup"
            aria-label={departmentLabel}
          >
            <button
              type="button"
              role="radio"
              aria-checked={state.subCategory === "all"}
              onClick={() => onChange({ ...state, subCategory: "all" })}
              className={cn(
                chipBase,
                "text-left",
                state.subCategory === "all" ? chipOn : chipOff,
              )}
            >
              All {departmentLabel}
            </button>
            {subCategories.map((sub) => {
              const on = state.subCategory === sub.id
              return (
                <button
                  key={sub.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange({ ...state, subCategory: sub.id })}
                  className={cn(chipBase, "text-left", on ? chipOn : chipOff)}
                >
                  {sub.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="min-w-0 space-y-2">
        <legend className="type-sm font-semibold text-foreground">
          Average rating
        </legend>
        <div
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Minimum rating"
        >
          <button
            type="button"
            role="radio"
            aria-checked={state.minRating === 0}
            onClick={() => onChange({ ...state, minRating: 0 })}
            className={cn(
              chipBase,
              "px-2",
              state.minRating === 0 ? chipOn : chipOff,
            )}
          >
            Any
          </button>
          {ratingOptions.map((n) => {
            const on = state.minRating === n
            const c = ratingCounts?.[n]
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...state, minRating: n })}
                className={cn(
                  chipBase,
                  "inline-flex items-center justify-center gap-1 px-2",
                  on ? chipOn : chipOff,
                )}
              >
                <ProductRating value={n} size={12} />
                <span className="sr-only sm:not-sr-only sm:inline">&amp; up</span>
                {typeof c === "number" ? (
                  <span className="tabular-nums opacity-70">{c}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-2">
        <legend className="type-sm font-semibold text-foreground">Price</legend>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={state.priceMin ?? ""}
            onChange={(e) => {
              const v = e.target.value
              onChange({ ...state, priceMin: v === "" ? null : Number(v) })
            }}
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 type-sm outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary/20"
            aria-label="Minimum price"
          />
          <span className="text-muted-foreground" aria-hidden>
            –
          </span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            value={state.priceMax ?? ""}
            onChange={(e) => {
              const v = e.target.value
              onChange({ ...state, priceMax: v === "" ? null : Number(v) })
            }}
            className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 type-sm outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary/20"
            aria-label="Maximum price"
          />
        </div>
      </fieldset>

      <ListingLocationFilter
        value={state.location}
        enabled={locationEnabled}
        onChange={(location: LocationFilterValue) =>
          onChange({ ...state, location })
        }
      />
    </div>
  )
}
