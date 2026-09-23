import { useState } from "react"
import { CaretDown, Check, Lightning, X } from "@phosphor-icons/react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui"
import type {
  AppliedFacet,
  ListingFacetState,
} from "@/components/listing/ListingFacets"
import type {
  ListingSellerOpt,
  ListingSubCategory,
} from "@/components/listing/ListingFilters"
import { brand } from "@/design/brand"
import { cn } from "@/lib/utils"

type Props = {
  sellers: ListingSellerOpt[]
  subCategories?: ListingSubCategory[]
  state: ListingFacetState
  onChange: (next: ListingFacetState) => void
  onClearAll: () => void
  applied: AppliedFacet[]
  className?: string
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

const REGIONS = [
  "Greater Accra",
  "Ashanti Region",
  "Central Region",
  "Eastern Region",
  "Western Region",
]

const PRICE_PRESETS = [
  { label: "Under GH₵ 100", min: null, max: 100 },
  { label: "GH₵ 100 - 500", min: 100, max: 500 },
  { label: "GH₵ 500 - 1,000", min: 500, max: 1000 },
  { label: "Over GH₵ 1,000", min: 1000, max: null },
]

export function ListingQuickFilters({
  sellers,
  state,
  onChange,
  onClearAll,
  applied,
  className,
}: Props) {
  const [sellerSearch, setSellerSearch] = useState("")
  const [localMin, setLocalMin] = useState(state.priceMin != null ? String(state.priceMin) : "")
  const [localMax, setLocalMax] = useState(state.priceMax != null ? String(state.priceMax) : "")

  const isExpressActive = state.sellerHandles.length > 0 && sellers[0] && state.sellerHandles.includes(sellers[0].handle)

  const filteredSellers = sellers.filter((s) =>
    s.name.toLowerCase().includes(sellerSearch.toLowerCase()),
  )

  function toggleSeller(handle: string) {
    const next = state.sellerHandles.includes(handle)
      ? state.sellerHandles.filter((h) => h !== handle)
      : [...state.sellerHandles, handle]
    onChange({ ...state, sellerHandles: next })
  }

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

  function setPresetPrice(min: number | null, max: number | null) {
    setLocalMin(min != null ? String(min) : "")
    setLocalMax(max != null ? String(max) : "")
    onChange({
      ...state,
      priceMin: min,
      priceMax: max,
    })
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Quick Filter Buttons Strip (Jumia reference layout) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Express Delivery Pill */}
        <button
          type="button"
          onClick={() => {
            if (sellers.length > 0) {
              toggleSeller(sellers[0].handle)
            }
          }}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-all shadow-2xs",
            isExpressActive
              ? "bg-primary text-primary-foreground ring-1 ring-primary-strong"
              : "border border-border/80 bg-background text-foreground hover:bg-muted",
          )}
        >
          <Lightning size={14} weight="fill" className={isExpressActive ? "text-primary-foreground" : "text-primary-strong"} />
          <span>EXPRESS</span>
        </button>

        {/* Brand / Seller Popover */}
        {sellers.length > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted shadow-2xs",
                  state.sellerHandles.length > 0 && "border-primary bg-muted/60 font-bold text-primary-strong",
                )}
              >
                <span>Brand / Seller</span>
                {state.sellerHandles.length > 0 ? (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {state.sellerHandles.length}
                  </span>
                ) : null}
                <CaretDown size={12} className="opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3 shadow-lg">
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Select Sellers
                </div>
                {sellers.length > 6 ? (
                  <input
                    type="search"
                    placeholder="Search sellers…"
                    value={sellerSearch}
                    onChange={(e) => setSellerSearch(e.target.value)}
                    className="h-8 w-full rounded-md border border-border/80 bg-muted/30 px-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                ) : null}
                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {filteredSellers.map((s) => {
                    const checked = state.sellerHandles.includes(s.handle)
                    return (
                      <button
                        key={s.handle}
                        type="button"
                        onClick={() => toggleSeller(s.handle)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition",
                          checked
                            ? "bg-muted font-bold text-foreground"
                            : "text-foreground hover:bg-muted/50",
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className={cn(
                              "flex h-3.5 w-3.5 items-center justify-center rounded-xs border transition-colors",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/80 bg-background",
                            )}
                          >
                            {checked ? <Check size={10} weight="bold" /> : null}
                          </span>
                          <span className="truncate">{s.name}</span>
                        </span>
                        {typeof s.count === "number" ? (
                          <span className="text-[11px] text-muted-foreground">
                            ({s.count})
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        {/* Price Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted shadow-2xs",
                (state.priceMin != null || state.priceMax != null) &&
                  "border-primary bg-muted/60 font-bold text-primary-strong",
              )}
            >
              <span>Price</span>
              {state.priceMin != null || state.priceMax != null ? (
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
              <CaretDown size={12} className="opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3 shadow-lg">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Price (GH₵)
              </div>
              <form onSubmit={handleApplyPrice} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                      GH₵
                    </span>
                    <input
                      type="number"
                      placeholder="Min"
                      value={localMin}
                      onChange={(e) => setLocalMin(e.target.value)}
                      className="h-8 w-full rounded-md border border-border/80 bg-background pl-8 pr-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">-</span>
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                      GH₵
                    </span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={localMax}
                      onChange={(e) => setLocalMax(e.target.value)}
                      className="h-8 w-full rounded-md border border-border/80 bg-background pl-8 pr-2 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-8 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary-strong transition-colors"
                  >
                    Go
                  </button>
                </div>
              </form>

              <div className="border-t border-border/50 pt-2 space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground mb-1">
                  Quick Presets:
                </div>
                {PRICE_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPresetPrice(p.min, p.max)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted transition"
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Rating Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted shadow-2xs",
                state.minRating > 0 && "border-primary bg-muted/60 font-bold text-primary-strong",
              )}
            >
              <span>Rating</span>
              {state.minRating > 0 ? (
                <span className="text-xs font-bold text-primary-strong">
                  {state.minRating}★+
                </span>
              ) : null}
              <CaretDown size={12} className="opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-3 shadow-lg">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Product Rating
              </div>
              <div className="space-y-1">
                {[4, 3, 2, 1].map((r) => {
                  const on = state.minRating === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => onChange({ ...state, minRating: on ? 0 : r })}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 transition",
                        on ? "bg-muted font-bold text-foreground" : "hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <StarRow count={r} />
                        <span className="text-xs text-foreground">& above</span>
                      </div>
                      {on ? <Check size={12} weight="bold" className="text-primary-strong" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Location / Shipped From Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-full border border-border/80 bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted shadow-2xs",
                state.location.province && "border-primary bg-muted/60 font-bold text-primary-strong",
              )}
            >
              <span>Shipped From</span>
              {state.location.province ? (
                <span className="truncate max-w-[5rem] text-primary-strong font-bold">
                  {state.location.province}
                </span>
              ) : null}
              <CaretDown size={12} className="opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-3 shadow-lg">
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Shipped From (Region)
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => onChange({ ...state, location: { province: null, city: null } })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition",
                    state.location.province == null ? "bg-muted font-bold text-foreground" : "hover:bg-muted/50 text-foreground",
                  )}
                >
                  <span>All Regions</span>
                  {state.location.province == null ? <Check size={12} weight="bold" className="text-primary-strong" /> : null}
                </button>
                {REGIONS.map((reg) => {
                  const on = state.location.province === reg
                  return (
                    <button
                      key={reg}
                      type="button"
                      onClick={() => onChange({ ...state, location: { province: on ? null : reg, city: null } })}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition",
                        on ? "bg-muted font-bold text-foreground" : "hover:bg-muted/50 text-foreground",
                      )}
                    >
                      <span>{reg}</span>
                      {on ? <Check size={12} weight="bold" className="text-primary-strong" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {applied.length > 0 ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-bold text-primary-strong hover:underline ml-1"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {/* Applied Filter Chips inline */}
      {applied.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {applied.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground shadow-2xs"
            >
              <span className="text-muted-foreground">{f.group}:</span>
              <span className="font-semibold">{f.label}</span>
              <button
                type="button"
                onClick={() => onChange(f.clear(state))}
                className="ml-0.5 rounded-xs p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove filter ${f.label}`}
              >
                <X size={11} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
