/**
 * PLP sidebar.
 *
 * Container language: every facet surface is the same neutral card. The
 * department hue is carried by a 3px top rule and the active-row accent
 * (`--dept-ink`, AA on card and cream) instead of a solid panel fill —
 * the wayfinding signal survives at a fraction of the visual cost, and
 * stops competing with gold, which is the only colour allowed to mean
 * "act".
 *
 * State: one `ListingFacetState`, owned by the route and serialised to the
 * URL. Departments navigate; subcategories are facets.
 */
import { Link } from "@tanstack/react-router"
import { IconSafe } from "@/design/icons"
import { deptThemeClass } from "@/lib/category-theme"
import type { ListingFacetState } from "@/components/listing/ListingFacets"
import { cn } from "@/lib/utils"
import { useId, useState, type ReactNode } from "react"

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
  categories: ListingCategory[]
  /** Real child categories of the active department (empty when flat). */
  subCategories?: ListingSubCategory[]
  sellers: ListingSellerOpt[]
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  onClearAll?: () => void
  className?: string
}

/** Sellers past this fold stay hidden behind "Show all" — long lists read as noise. */
const SELLER_FOLD = 6

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value]
}

function FilterSection({
  title,
  defaultOpen = true,
  /** Shown next to the title when the section holds a selection. */
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
    <div className={className}>
      <button
        type="button"
        id={headingId}
        className={cn(
          "flex w-full min-h-11 items-center justify-between gap-2 text-left type-base font-semibold",
          "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          open && "mb-2",
        )}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          {title}
          {badge ? (
            <span className="facet-accent-text type-sm font-bold">
              {badge}
            </span>
          ) : null}
        </span>
        <IconSafe
          name="chevron-right"
          size={16}
          preferAsset={false}
          className={cn(
            "shrink-0 opacity-70 transition-transform duration-200",
            open ? "rotate-90" : "rotate-0",
          )}
        />
      </button>
      <div id={panelId} role="region" aria-labelledby={headingId} hidden={!open}>
        {open ? children : null}
      </div>
    </div>
  )
}

export function ListingFilters({
  activeCategorySlug,
  departmentName,
  categories,
  subCategories = [],
  sellers,
  state,
  onChange,
  onClearAll,
  className,
}: Props) {
  const themeClass = deptThemeClass(
    departmentName,
    activeCategorySlug === "all" ? null : activeCategorySlug,
  )
  const [showAllSellers, setShowAllSellers] = useState(false)
  const visibleSellers = showAllSellers ? sellers : sellers.slice(0, SELLER_FOLD)

  return (
    <aside
      className={cn("space-y-3", themeClass, className)}
      aria-label="Filters"
    >
      {/* Categories — dept identity as rule + active accent, not a fill */}
      {categories.length > 0 ? (
        <div className="facet-panel rounded-xl p-4 shadow-xs">
          <FilterSection
            title="Categories"
            defaultOpen
            badge={state.subCategory !== "all" ? 1 : undefined}
          >
            <ul className="space-y-0.5 type-sm">
              <li>
                <Link
                  to="/categories/$slug"
                  params={{ slug: "all" }}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 transition",
                    activeCategorySlug === "all"
                      ? "facet-row-on font-semibold"
                      : "hover:bg-muted",
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
                        "flex min-h-11 items-center gap-2.5 truncate rounded-lg px-2.5 py-2 transition",
                        on ? "facet-row-on font-semibold" : "hover:bg-muted",
                      )}
                    >
                      <RadioDot on={on} />
                      {c.name}
                    </Link>

                    {/* Subcategory is a facet, not a route — one writer only. */}
                    {on && subCategories.length > 0 ? (
                      <ul
                        className="ms-4 space-y-0.5 border-s border-border ps-2 type-sm"
                        role="radiogroup"
                        aria-label={`${c.name} subcategories`}
                      >
                        <li>
                          <SubOption
                            on={state.subCategory === "all"}
                            label={`All ${c.name}`}
                            onSelect={() =>
                              onChange({ ...state, subCategory: "all" })
                            }
                          />
                        </li>
                        {subCategories.map((sub) => (
                          <li key={sub.id}>
                            <SubOption
                              on={state.subCategory === sub.id}
                              label={sub.label}
                              onSelect={() =>
                                onChange({ ...state, subCategory: sub.id })
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </FilterSection>
        </div>
      ) : null}

      {/* Sellers — secondary facet, collapsed until asked for */}
      {sellers.length > 0 ? (
        <div className="facet-panel facet-panel-plain rounded-xl p-4 shadow-xs">
          <FilterSection
            title="Sellers"
            defaultOpen={state.sellerHandles.length > 0}
            badge={state.sellerHandles.length || undefined}
          >
            <ul className="space-y-0.5 type-sm">
              {visibleSellers.map((s) => {
                const selected = state.sellerHandles.includes(s.handle)
                return (
                  <li key={s.handle}>
                    <label
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 transition",
                        selected ? "facet-row-on" : "hover:bg-muted",
                      )}
                    >
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
                        <span className="tabular-nums type-sm text-muted-foreground">
                          {s.count}
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
                className={cn(
                  "mt-1.5 min-h-10 type-sm font-semibold underline underline-offset-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                )}
              >
                {showAllSellers
                  ? "Show fewer"
                  : `Show all ${sellers.length} sellers`}
              </button>
            ) : null}
          </FilterSection>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-card p-3 type-sm text-muted-foreground">
          No sellers in this view.
        </p>
      )}

      {onClearAll ? (
        <button
          type="button"
          onClick={onClearAll}
          className={cn(
            "min-h-11 w-full rounded-xl border border-border bg-card px-4 type-sm font-semibold transition hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          )}
        >
          Clear all filters
        </button>
      ) : null}
    </aside>
  )
}

function SubOption({
  on,
  label,
  onSelect,
}: {
  on: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={cn(
        "flex min-h-10 w-full items-center gap-2 truncate rounded-lg px-2 py-1.5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        on ? "facet-row-on font-semibold" : "hover:bg-muted",
      )}
    >
      {label}
    </button>
  )
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "facet-dot flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
      )}
      aria-hidden
    >
      {on ? <span className="h-1.5 w-1.5 rounded-full bg-card" /> : null}
    </span>
  )
}
