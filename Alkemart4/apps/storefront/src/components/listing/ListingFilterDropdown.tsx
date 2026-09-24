import { useEffect, useId, useRef, useState } from "react"
import { IconSafe } from "@/design/icons"
import type { ListingFacetState } from "@/components/listing/ListingFacets"
import { cn } from "@/lib/utils"

export type FilterDropdownSubCategory = {
  id: string
  label: string
}

export type FilterDropdownSeller = {
  handle: string
  name: string
  count?: number
}

type Props = {
  subCategories?: FilterDropdownSubCategory[]
  departmentLabel: string
  sellers: FilterDropdownSeller[]
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  onClearAll: () => void
  activeCount: number
  className?: string
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value]
}

/**
 * Single compact "Filters" dropdown at the top of the PLP.
 * Replaces the full-width filter strip + sidebar: one button, one panel.
 * All facets still read/write the same `ListingFacetState` (URL-owned).
 */
export function ListingFilterDropdown({
  subCategories = [],
  departmentLabel,
  sellers,
  state,
  onChange,
  onClearAll,
  activeCount,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open ])

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          open && "border-primary/40 bg-muted",
        )}
      >
        <IconSafe name="filter-list" size={16} preferAsset={false} />
        Filters
        {activeCount > 0 ? (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-primary-foreground">
            {activeCount}
            <span className="sr-only">
              {" "}
              active filter{activeCount === 1 ? "" : "s"}
            </span>
          </span>
        ) : null}
        <IconSafe
          name="chevron-right"
          size={16}
          preferAsset={false}
          className={cn(
            "shrink-0",
            open ? "rotate-90" : "rotate-0",
          )}
        />
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={buttonId}
          aria-label="Listing filters"
          className="absolute left-0 top-[calc(100%+8px)] z-30 w-[min(20rem,calc(100vw-2rem))] space-y-4 rounded-lg border border-border bg-card p-4 shadow-lg"
        >
          {subCategories.length > 0 ? (
            <div className="space-y-1.5">
              <label
                htmlFor={`${panelId}-sub`}
                className="text-sm font-semibold text-foreground"
              >
                {departmentLabel}
              </label>
              <select
                id={`${panelId}-sub`}
                value={state.subCategory}
                onChange={(e) =>
                  onChange({ ...state, subCategory: e.target.value })
                }
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All</option>
                {subCategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor={`${panelId}-rating`}
              className="text-sm font-semibold text-foreground"
            >
              Average rating
            </label>
            <select
              id={`${panelId}-rating`}
              value={String(state.minRating)}
              onChange={(e) =>
                onChange({ ...state, minRating: Number(e.target.value) })
              }
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary/20"
            >
              <option value="0">Any rating</option>
              <option value="4">4★ &amp; up</option>
              <option value="3">3★ &amp; up</option>
              <option value="2">2★ &amp; up</option>
              <option value="1">1★ &amp; up</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <span
              id={`${panelId}-price`}
              className="block text-sm font-semibold text-foreground"
            >
              Price
            </span>
            <div
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
              role="group"
              aria-labelledby={`${panelId}-price`}
            >
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
                className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary/20"
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
                className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary-strong focus:ring-2 focus:ring-primary/20"
                aria-label="Maximum price"
              />
            </div>
          </div>

          {sellers.length > 0 ? (
            <div className="space-y-1.5">
              <span
                id={`${panelId}-sellers`}
                className="block text-sm font-semibold text-foreground"
              >
                Sellers
              </span>
              <ul
                className="max-h-44 space-y-0.5 overflow-y-auto text-sm"
                aria-labelledby={`${panelId}-sellers`}
              >
                {sellers.map((s) => {
                  const selected = state.sellerHandles.includes(s.handle)
                  return (
                    <li key={s.handle}>
                      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-muted">
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
                          <span className="tabular-nums text-sm text-muted-foreground">
                            {s.count}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Show results
            </button>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  onClearAll()
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
