import { IconSafe } from "@/design/icons"
import { ProductRating } from "@/components/product/ProductRating"
import type { ListingSort } from "@/components/listing/ListingFilters"
import type { ListingViewMode } from "@/components/listing/ListingLayout"
import {
  ListingLocationFilter,
  type LocationFilterValue,
} from "@/components/listing/ListingLocationFilter"
import { cn } from "@/lib/utils"

export type FilterStripState = {
  /** Sub-category label or "all" */
  subCategory: string
  /** Minimum star rating 0 = any */
  minRating: number
  priceMin: number | null
  priceMax: number | null
  sort: ListingSort
  viewMode: ListingViewMode
  /** Ghana discovery location */
  location: LocationFilterValue
}

type Props = {
  departmentLabel: string
  subCategories?: string[]
  state: FilterStripState
  onChange: (next: FilterStripState) => void
  /** True when Meili (or catalog) supports location facets */
  locationEnabled?: boolean
  className?: string
}

const RATING_OPTIONS = [5, 4, 3, 2, 1] as const

/**
 * Mowafer imgi_11/12 horizontal filter strip under PLP hero.
 * Columns: Sub-category · Average Rating · Price · View mode
 * Modular — no inline styles.
 */
export function ListingFilterStrip({
  departmentLabel,
  subCategories = [],
  state,
  onChange,
  locationEnabled = false,
  className,
}: Props) {
  const subs =
    subCategories.length > 0
      ? subCategories
      : [`All ${departmentLabel}`, departmentLabel]

  return (
    <div
      className={cn(
        "listing-filter-strip grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:items-start",
        className,
      )}
      role="region"
      aria-label="Listing filters"
    >
      {/* Sub-categories */}
      <fieldset className="min-w-0 space-y-2">
        <legend className="type-sm font-bold text-foreground">
          {departmentLabel}
        </legend>
        <ul className="space-y-1.5">
          {subs.map((label, i) => {
            const id = i === 0 ? "all" : label
            const on = state.subCategory === id
            return (
              <li key={label}>
                <label className="flex cursor-pointer items-center gap-2 type-sm">
                  <input
                    type="radio"
                    name="plp-subcat"
                    className="size-4 accent-primary"
                    checked={on}
                    onChange={() => onChange({ ...state, subCategory: id })}
                  />
                  <span
                    className={cn(
                      on ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      {/* Average rating */}
      <fieldset className="min-w-0 space-y-2">
        <legend className="type-sm font-bold text-foreground">
          Average Rating
        </legend>
        <ul className="space-y-1.5">
          <li>
            <label className="flex cursor-pointer items-center gap-2 type-sm">
              <input
                type="radio"
                name="plp-rating"
                className="size-4 accent-primary"
                checked={state.minRating === 0}
                onChange={() => onChange({ ...state, minRating: 0 })}
              />
              <span className="text-muted-foreground">Any</span>
            </label>
          </li>
          {RATING_OPTIONS.map((n) => (
            <li key={n}>
              <label className="flex cursor-pointer items-center gap-2 type-sm">
                <input
                  type="radio"
                  name="plp-rating"
                  className="size-4 accent-primary"
                  checked={state.minRating === n}
                  onChange={() => onChange({ ...state, minRating: n })}
                />
                <ProductRating value={n} size={12} />
                <span className="text-muted-foreground">&amp; up</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {/* Price */}
      <fieldset className="min-w-0 space-y-2">
        <legend className="type-sm font-bold text-foreground">Price</legend>
        <div className="flex items-center gap-2">
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
            className="h-10 w-full rounded-full border border-border bg-background px-3 type-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Minimum price"
          />
          <span className="text-muted-foreground">–</span>
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
            className="h-10 w-full rounded-full border border-border bg-background px-3 type-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Maximum price"
          />
        </div>
      </fieldset>

      {/* Ghana location — discovery (honest when not indexed) */}
      <ListingLocationFilter
        value={state.location}
        enabled={locationEnabled}
        onChange={(location) => onChange({ ...state, location })}
      />

      {/* View + sort */}
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="mb-2 type-sm font-bold text-foreground">View</p>
          <div
            className="inline-flex overflow-hidden rounded-xl border border-border bg-card"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              aria-pressed={state.viewMode === "grid"}
              aria-label="Grid view"
              onClick={() => onChange({ ...state, viewMode: "grid" })}
              className={cn(
                "flex h-10 w-10 items-center justify-center transition",
                state.viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <IconSafe name="filter-grid" size={18} />
            </button>
            <button
              type="button"
              aria-pressed={state.viewMode === "list"}
              aria-label="List view"
              onClick={() => onChange({ ...state, viewMode: "list" })}
              className={cn(
                "flex h-10 w-10 items-center justify-center border-l border-border transition",
                state.viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <IconSafe name="filter-list" size={18} preferAsset={false} />
            </button>
          </div>
        </div>
        <div>
          <label
            className="mb-2 block type-sm font-bold text-foreground"
            htmlFor="plp-strip-sort"
          >
            Sort
          </label>
          <select
            id="plp-strip-sort"
            value={state.sort}
            onChange={(e) =>
              onChange({
                ...state,
                sort: e.target.value as ListingSort,
              })
            }
            className="h-10 w-full rounded-xl border border-border bg-background px-3 type-sm font-semibold outline-none focus:border-primary"
          >
            <option value="featured">Featured</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="title">Name A–Z</option>
          </select>
        </div>
      </div>
    </div>
  )
}
