/**
 * Alkemart PLP Sidebar Filters.
 *
 * Visual hierarchy:
 * - Single cohesive card container (rounded-xl, subtle border and shadow)
 * - Uppercase, clean tracking section headers (CATEGORY, BRAND, PRICE, RATING)
 * - Clear, readable typography (text-sm for categories, text-xs for controls)
 * - Synchronized with URL-owned ListingFacetState
 */
import { Link } from "@tanstack/react-router"
import { IconSafe } from "@/design/icons"
import { brand } from "@/design/brand"
import { categoryColor } from "@/lib/category-theme"
import type { ListingFacetState } from "@/components/listing/ListingFacets"
import { cn } from "@/lib/utils"
import { useId, useState, useEffect, type ReactNode } from "react"

export type ListingCategory = {
  id: string
  name: string
  handle?: string | null
}

export type ListingSubCategory = {
  id: string
  label: string
  handle: string | null
}

export type ListingSellerOpt = {
  handle: string
  name: string
  count?: number
}

type Props = {
  activeCategorySlug: string
  departmentName: string
  categories?: ListingCategory[]
  /** Real child categories of the active department (empty when flat). */
  subCategories?: ListingSubCategory[]
  sellers: ListingSellerOpt[]
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  onClearAll?: () => void
  className?: string
}

const SELLER_FOLD = 6

const REGIONS = [
  "Greater Accra",
  "Ashanti Region",
  "Central Region",
  "Eastern Region",
  "Western Region",
]

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value]
}

function FilterSection({
  title,
  defaultOpen = true,
  badge,
  children,
  className,
}: {
  title: string
  defaultOpen?: boolean
  badge?: number
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  const headingId = useId()

  return (
    <div className={cn("p-4", className)}>
      <button
        type="button"
        id={headingId}
        className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-foreground transition hover:text-primary-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          {title}
          {badge ? (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-xs bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <IconSafe
          name="chevron-right"
          size={14}
          preferAsset={false}
          className={cn(
            "shrink-0 opacity-70 transition-transform duration-200",
            open ? "rotate-90" : "rotate-0",
          )}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
        className={cn(open ? "mt-3" : "hidden")}
      >
        {children}
      </div>
    </div>
  )
}

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          aria-hidden
          className="shrink-0"
        >
          <path
            d="M12 2.5l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 16.98 6.3 20.06l1.09-6.35-4.62-4.5 6.38-.93L12 2.5z"
            fill={i < count ? brand.primary : "#e2e8f0"}
          />
        </svg>
      ))}
    </div>
  )
}

export function ListingFilters({
  activeCategorySlug,
  departmentName: _departmentName,
  categories = [],
  subCategories = [],
  sellers,
  state,
  onChange,
  onClearAll,
  className,
}: Props) {
  const [showAllSellers, setShowAllSellers] = useState(false)
  const [localMin, setLocalMin] = useState<string>(
    state.priceMin != null ? String(state.priceMin) : "",
  )
  const [localMax, setLocalMax] = useState<string>(
    state.priceMax != null ? String(state.priceMax) : "",
  )

  useEffect(() => {
    setLocalMin(state.priceMin != null ? String(state.priceMin) : "")
  }, [state.priceMin])

  useEffect(() => {
    setLocalMax(state.priceMax != null ? String(state.priceMax) : "")
  }, [state.priceMax])

  const visibleSellers = showAllSellers ? sellers : sellers.slice(0, SELLER_FOLD)

  function handleApplyPrice(e: React.FormEvent) {
    e.preventDefault()
    const minVal = localMin.trim() === "" ? null : Number(localMin)
    const maxVal = localMax.trim() === "" ? null : Number(localMax)
    onChange({
      ...state,
      priceMin: Number.isFinite(minVal) ? minVal : null,
      priceMax: Number.isFinite(maxVal) ? maxVal : null,
    })
  }

  return (
    <div className={cn("space-y-3.5", className)} aria-label="Filter products">
      {/* 1. Mowafer Signature: Chromatic Department Categories Panel */}
      {categories.length > 0 ? (
        <div className="dept-panel rounded-lg p-3.5 shadow-2xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-current/20">
            <span className="text-xs font-bold uppercase tracking-wider">
              {_departmentName && _departmentName !== "All" ? _departmentName : "Categories"}
            </span>
            {state.subCategory !== "all" || (activeCategorySlug !== "all" && activeCategorySlug !== "") ? (
              <span className="rounded-full bg-current/15 px-1.5 py-0.5 text-[10px] font-bold">
                Filtered
              </span>
            ) : null}
          </div>

          <ul className="space-y-1 text-xs sm:text-sm">
            <li>
              <Link
                to="/categories/$slug"
                params={{ slug: "all" }}
                className={cn(
                  "flex items-center justify-between rounded-md px-2.5 py-1.5 transition font-medium text-xs sm:text-sm",
                  activeCategorySlug === "all"
                    ? "bg-current/15 font-bold shadow-2xs"
                    : "hover:bg-current/10 opacity-90 hover:opacity-100",
                )}
              >
                <span>All Products</span>
                {activeCategorySlug === "all" ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                ) : null}
              </Link>
            </li>

            {categories.map((c) => {
              const slug = c.handle || c.id
              const on = activeCategorySlug === slug

              return (
                <li key={c.id}>
                  <Link
                    to="/categories/$slug"
                    params={{ slug }}
                    className={cn(
                      "group flex items-center justify-between rounded-md px-2.5 py-1.5 transition font-medium text-xs sm:text-sm",
                      on
                        ? "bg-current/15 font-bold shadow-2xs"
                        : "hover:bg-current/10 opacity-90 hover:opacity-100",
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    {on ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                    ) : null}
                  </Link>

                  {/* Subcategories (when this category is active) */}
                  {on && subCategories.length > 0 ? (
                    <ul
                      className="ms-3 mt-1 space-y-0.5 border-s border-current/25 ps-2 text-xs"
                      role="radiogroup"
                      aria-label={`${c.name} subcategories`}
                    >
                      {subCategories.map((sub) => {
                        const isSubActive = state.subCategory === sub.id
                        return (
                          <li key={sub.id}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isSubActive}
                              onClick={() =>
                                onChange({
                                  ...state,
                                  subCategory: isSubActive ? "all" : sub.id,
                                })
                              }
                              className={cn(
                                "flex w-full items-center rounded-sm px-2 py-1 text-left transition font-medium",
                                isSubActive
                                  ? "bg-current/15 font-bold"
                                  : "hover:bg-current/10 opacity-90 hover:opacity-100",
                              )}
                            >
                              {sub.label}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {/* 2. Mowafer Signature: Dark Brands / Sellers Panel */}
      {sellers.length > 0 ? (
        <div className="brands-panel rounded-lg p-3.5 shadow-2xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15 text-xs font-bold uppercase tracking-wider text-white">
            <span>Seller / Brand</span>
            {state.sellerHandles.length > 0 ? (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-xs bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {state.sellerHandles.length}
              </span>
            ) : null}
          </div>
          <ul className="space-y-1.5 text-xs sm:text-sm text-white/90">
            {visibleSellers.map((s) => {
              const selected = state.sellerHandles.includes(s.handle)
              return (
                <li key={s.handle}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 transition hover:bg-white/10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/30 bg-white/10 text-primary focus:ring-primary focus:ring-offset-0"
                      checked={selected}
                      onChange={() =>
                        onChange({
                          ...state,
                          sellerHandles: toggle(state.sellerHandles, s.handle),
                        })
                      }
                    />
                    <span className={cn("min-w-0 flex-1 truncate text-white", selected && "font-bold text-white")}>
                      {s.name}
                    </span>
                    {typeof s.count === "number" ? (
                      <span className="tabular-nums text-xs text-white/60">
                        ({s.count})
                      </span>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
          {sellers.length > SELLER_FOLD ? (
            <button
              type="button"
              onClick={() => setShowAllSellers((v) => !v)}
              className="mt-2 text-xs font-semibold text-primary underline underline-offset-2 hover:text-white focus-visible:outline-none"
            >
              {showAllSellers
                ? "Show fewer"
                : `Show all (${sellers.length})`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 3. Secondary Facet Filters (Price, Rating, Region, Clear All) */}
      <div className="rounded-lg border border-border/80 bg-card shadow-2xs divide-y divide-border/60">
        {/* Price Filter (GH₵) */}
        <FilterSection
          title="Price (GH₵)"
          defaultOpen
          badge={state.priceMin != null || state.priceMax != null ? 1 : undefined}
        >
          <form onSubmit={handleApplyPrice} className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={localMin}
                  onChange={(e) => setLocalMin(e.target.value)}
                  className="h-8.5 w-full rounded-md border border-border/80 bg-background px-2.5 text-xs outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                  aria-label="Minimum price"
                />
              </div>
              <span className="text-muted-foreground">–</span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={localMax}
                  onChange={(e) => setLocalMax(e.target.value)}
                  className="h-8.5 w-full rounded-md border border-border/80 bg-background px-2.5 text-xs outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                  aria-label="Maximum price"
                />
              </div>
            </div>
            <button
              type="submit"
              className="h-8.5 w-full rounded-md bg-primary py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-xs transition hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              Apply
            </button>
          </form>
        </FilterSection>

        {/* Product Rating */}
        <FilterSection
          title="Product Rating"
          defaultOpen
          badge={state.minRating > 0 ? 1 : undefined}
        >
          <ul className="space-y-1.5 text-xs sm:text-sm">
            {[4, 3, 2, 1].map((stars) => {
              const selected = state.minRating === stars
              return (
                <li key={stars}>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...state,
                        minRating: selected ? 0 : stars,
                      })
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-muted/50",
                      selected && "font-semibold text-primary-strong bg-muted",
                    )}
                  >
                    <StarRow count={stars} />
                    <span className="text-muted-foreground text-xs">&amp; above</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </FilterSection>

        {/* Shipped From / Region */}
        <FilterSection
          title="Shipped From"
          defaultOpen={false}
          badge={state.location?.province ? 1 : undefined}
        >
          <div className="space-y-1 text-xs">
            {REGIONS.map((region) => {
              const isSelected = state.location?.province === region
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...state,
                      location: {
                        ...state.location,
                        province: isSelected ? null : region,
                      },
                    })
                  }
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition font-medium",
                    isSelected
                      ? "bg-muted font-bold text-primary-strong"
                      : "text-foreground hover:bg-muted/50",
                  )}
                >
                  <span>{region}</span>
                  {isSelected ? (
                    <span className="text-primary font-bold">✓</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </FilterSection>

        {/* Clear All action */}
        {onClearAll ? (
          <div className="p-3">
            <button
              type="button"
              onClick={onClearAll}
              className="w-full rounded-md border border-border/80 bg-background py-2 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Clear All Filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
