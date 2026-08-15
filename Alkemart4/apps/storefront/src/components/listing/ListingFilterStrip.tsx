import { ProductRating } from "@/components/product/ProductRating"
import type { ListingSort } from "@/components/listing/ListingFilters"
import type { ListingViewMode } from "@/components/listing/ListingLayout"
import {
  ListingLocationFilter,
  type LocationFilterValue,
} from "@/components/listing/ListingLocationFilter"
import { cn } from "@/lib/utils"

export type FilterStripState = {
  /** Child category id when the department has a real subcategory — "all" otherwise. */
  subCategory: string
  minRating: number
  priceMin: number | null
  priceMax: number | null
  sort: ListingSort
  viewMode: ListingViewMode
  location: LocationFilterValue
}

type Props = {
  departmentLabel: string
  /**
   * Real child categories of the current department. Empty when the
   * taxonomy is flat — the subcategory fieldset is omitted entirely then,
   * instead of showing a fake "All X / X" pair that filters nothing.
   */
  subCategories?: { id: string; label: string }[]
  state: FilterStripState
  onChange: (next: FilterStripState) => void
  locationEnabled?: boolean
  className?: string
}

const RATING_OPTIONS = [5, 4, 3, 2, 1] as const

/**
 * PLP filter facets as a responsive grid of chip fields.
 */
export function ListingFilterStrip({
  departmentLabel,
  subCategories = [],
  state,
  onChange,
  locationEnabled = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "listing-filter-strip grid gap-4 rounded-xl border border-border bg-card p-4",
        "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:items-start",
        className,
      )}
      role="region"
      aria-label="Listing filters"
    >
      {subCategories.length > 0 ? (
        <fieldset className="min-w-0 space-y-2">
          <legend className="type-sm font-bold text-foreground">
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
                "min-h-10 rounded-xl border px-3 py-2 text-left type-sm font-medium transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                state.subCategory === "all"
                  ? "border-primary bg-primary/15 font-semibold text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
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
                  className={cn(
                    "min-h-10 rounded-xl border px-3 py-2 text-left type-sm font-medium transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    on
                      ? "border-primary bg-primary/15 font-semibold text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {sub.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="min-w-0 space-y-2">
        <legend className="type-sm font-bold text-foreground">
          Average Rating
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
              "min-h-10 rounded-xl border px-2 py-2 type-sm font-medium transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              state.minRating === 0
                ? "border-primary bg-primary/15 font-semibold text-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            Any
          </button>
          {RATING_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={state.minRating === n}
              onClick={() => onChange({ ...state, minRating: n })}
              className={cn(
                "inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 py-2 type-sm transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                state.minRating === n
                  ? "border-primary bg-primary/15 font-semibold text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              <ProductRating value={n} size={12} />
              <span className="sr-only sm:not-sr-only sm:inline">&amp; up</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-2">
        <legend className="type-sm font-bold text-foreground">Price</legend>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={state.priceMin ?? ""}
            onChange={(e) => {
              const v = e.target.value
              onChange({
                ...state,
                priceMin: v === "" ? null : Number(v),
              })
            }}
            className="h-11 w-full min-w-0 rounded-full border border-border bg-background px-3 type-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
              onChange({
                ...state,
                priceMax: v === "" ? null : Number(v),
              })
            }}
            className="h-11 w-full min-w-0 rounded-full border border-border bg-background px-3 type-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Maximum price"
          />
        </div>
      </fieldset>

      <ListingLocationFilter
        value={state.location}
        enabled={locationEnabled}
        onChange={(location) => onChange({ ...state, location })}
      />
    </div>
  )
}
