/**
 * Mowafer PLP sidebar (imgi_11 / imgi_12):
 * - Accent Categories panel (CSS theme classes — no inline style)
 * - Dark Brands/Sellers panel (.brands-panel)
 * - Sort + price also available in ListingFilterStrip
 */
import { Link } from "@tanstack/react-router"
import { deptThemeClass } from "@/lib/category-theme"
import { cn } from "@/lib/utils"

export type ListingSort = "featured" | "price_asc" | "price_desc" | "title"

export type ListingFilterState = {
  sellerHandles: string[]
  sort: ListingSort
  priceMin?: number | null
  priceMax?: number | null
}

export type ListingCategory = {
  id: string
  name: string
  handle?: string | null
}

export type ListingSellerOpt = {
  handle: string
  name: string
  count?: number
}

type Props = {
  activeCategorySlug: string
  departmentName: string
  categories: ListingCategory[]
  sellers: ListingSellerOpt[]
  state: ListingFilterState
  onChange: (next: ListingFilterState) => void
  className?: string
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value]
}

export function ListingFilters({
  activeCategorySlug,
  departmentName,
  categories,
  sellers,
  state,
  onChange,
  className,
}: Props) {
  const themeClass = deptThemeClass(
    departmentName,
    activeCategorySlug === "all" ? null : activeCategorySlug,
  )
  const dirty =
    state.sellerHandles.length > 0 ||
    state.sort !== "featured" ||
    state.priceMin != null ||
    state.priceMax != null

  return (
    <aside className={cn("space-y-4", className)} aria-label="Filters">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <h2 className="text-base font-bold tracking-tight">Filters</h2>
        {dirty ? (
          <button
            type="button"
            className="type-sm font-semibold text-foreground underline underline-offset-2"
            onClick={() =>
              onChange({
                sellerHandles: [],
                sort: "featured",
                priceMin: null,
                priceMax: null,
              })
            }
          >
            Reset
          </button>
        ) : null}
      </div>

      {/* Categories — theme via CSS class, not style={} */}
      {categories.length > 0 ? (
        <div className={cn(themeClass)}>
          <div className="dept-panel rounded-lg p-4 shadow-sm">
            <h3 className="mb-3 text-base font-bold">Categories</h3>
            <ul className="space-y-1 type-sm">
              <li>
                <Link
                  to="/categories/$slug"
                  params={{ slug: "all" }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition",
                    activeCategorySlug === "all"
                      ? "bg-black/15 font-bold"
                      : "hover:bg-black/10",
                  )}
                >
                  <RadioDot on={activeCategorySlug === "all"} />
                  All products
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
                        "flex items-center gap-2.5 truncate rounded-xl px-2.5 py-2 transition",
                        on ? "bg-black/15 font-bold" : "hover:bg-black/10",
                      )}
                    >
                      <RadioDot on={on} />
                      {c.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Sellers — Mowafer dark brands panel */}
      {sellers.length > 0 ? (
        <div className="brands-panel rounded-lg p-4 shadow-sm">
          <h3 className="mb-3 text-base font-bold">Sellers</h3>
          <ul className="max-h-60 space-y-2 overflow-y-auto type-sm">
            {sellers.map((s) => {
              const selected = state.sellerHandles.includes(s.handle)
              return (
                <li key={s.handle}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-white/10">
                    <input
                      type="checkbox"
                      className="size-4 rounded accent-primary"
                      checked={selected}
                      onChange={() =>
                        onChange({
                          ...state,
                          sellerHandles: toggle(
                            state.sellerHandles,
                            s.handle,
                          ),
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    {typeof s.count === "number" ? (
                      <span className="type-sm opacity-80">{s.count}</span>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-card p-3 type-sm text-muted-foreground">
          No sellers in this view.
        </p>
      )}
    </aside>
  )
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
        on ? "border-current bg-current" : "border-current/50",
      )}
      aria-hidden
    >
      {on ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
    </span>
  )
}

export function sortListingProducts<
  T extends { title: string; amount?: number | null },
>(items: T[], sort: ListingSort): T[] {
  const copy = [...items]
  if (sort === "price_asc") {
    return copy.sort(
      (a, b) =>
        (a.amount ?? Number.POSITIVE_INFINITY) -
        (b.amount ?? Number.POSITIVE_INFINITY),
    )
  }
  if (sort === "price_desc") {
    return copy.sort(
      (a, b) =>
        (b.amount ?? Number.NEGATIVE_INFINITY) -
        (a.amount ?? Number.NEGATIVE_INFINITY),
    )
  }
  if (sort === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title))
  }
  return copy
}

export function filterListingBySellers<
  T extends { seller?: { handle?: string | null } | null },
>(items: T[], sellerHandles: string[]): T[] {
  if (!sellerHandles.length) return items
  const set = new Set(sellerHandles)
  return items.filter((p) => {
    const h = p.seller?.handle?.trim()
    return h ? set.has(h) : false
  })
}

export function filterListingByPrice<
  T extends { amount?: number | null },
>(items: T[], min?: number | null, max?: number | null): T[] {
  if (min == null && max == null) return items
  return items.filter((p) => {
    if (p.amount == null || !Number.isFinite(p.amount)) return false
    if (min != null && p.amount < min) return false
    if (max != null && p.amount > max) return false
    return true
  })
}

export function filterListingByRating<
  T extends { rating?: number | null },
>(items: T[], minRating: number): T[] {
  if (!minRating || minRating <= 0) return items
  return items.filter((p) => (p.rating ?? 5) >= minRating)
}
