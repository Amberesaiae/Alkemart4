import { useState, useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Checkbox,
  Button,
} from "@workspace/ui"
import {
  MagnifyingGlass,
  X,
  SlidersHorizontal,
  Check,
  SortAscending,
  SortDescending,
  Package,
} from "@phosphor-icons/react"
import { DEFAULT_STORE_CATEGORIES } from "@/lib/products"
import { iconForCategory } from "@/lib/catalog-nav"
import { IconSafe } from "@/design/icons"
import { cn } from "@/lib/utils"

export type SearchFilterDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery?: string
  initialCategory?: string[]
  initialMinPrice?: number
  initialMaxPrice?: number
  initialSort?: "relevance" | "price_asc" | "price_desc"
  initialInStock?: boolean
}

const PRICE_PRESETS = [
  { label: "Under GH₵ 50", min: undefined, max: 50 },
  { label: "GH₵ 50 – 200", min: 50, max: 200 },
  { label: "GH₵ 200 – 1,000", min: 200, max: 1000 },
  { label: "GH₵ 1,000+", min: 1000, max: undefined },
] as const

const SORT_OPTIONS = [
  { id: "relevance", label: "Best Match", icon: MagnifyingGlass },
  { id: "price_asc", label: "Price: Low to High", icon: SortAscending },
  { id: "price_desc", label: "Price: High to Low", icon: SortDescending },
] as const

export function SearchFilterDialog({
  open,
  onOpenChange,
  initialQuery = "",
  initialCategory = [],
  initialMinPrice,
  initialMaxPrice,
  initialSort = "relevance",
  initialInStock = false,
}: SearchFilterDialogProps) {
  const navigate = useNavigate()

  const [query, setQuery] = useState(initialQuery)
  const [categories, setCategories] = useState<string[]>(initialCategory)
  const [minPrice, setMinPrice] = useState<string>(
    initialMinPrice != null ? String(initialMinPrice) : "",
  )
  const [maxPrice, setMaxPrice] = useState<string>(
    initialMaxPrice != null ? String(initialMaxPrice) : "",
  )
  const [sort, setSort] = useState<"relevance" | "price_asc" | "price_desc">(initialSort)
  const [inStockOnly, setInStockOnly] = useState(initialInStock)

  // Sync state whenever dialog opens
  useEffect(() => {
    if (open) {
      setQuery(initialQuery)
      setCategories(initialCategory)
      setMinPrice(initialMinPrice != null ? String(initialMinPrice) : "")
      setMaxPrice(initialMaxPrice != null ? String(initialMaxPrice) : "")
      setSort(initialSort)
      setInStockOnly(initialInStock)
    }
  }, [open, initialQuery, initialCategory, initialMinPrice, initialMaxPrice, initialSort, initialInStock])

  const topCategories = DEFAULT_STORE_CATEGORIES.filter((c) => !c.parentCategoryId)

  function toggleCategory(handle: string) {
    setCategories((prev) =>
      prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle],
    )
  }

  function applyPreset(min?: number, max?: number) {
    setMinPrice(min != null ? String(min) : "")
    setMaxPrice(max != null ? String(max) : "")
  }

  function handleReset() {
    setQuery("")
    setCategories([])
    setMinPrice("")
    setMaxPrice("")
    setSort("relevance")
    setInStockOnly(false)
  }

  function handleApply() {
    onOpenChange(false)
    const min = minPrice.trim() ? Number(minPrice) : undefined
    const max = maxPrice.trim() ? Number(maxPrice) : undefined

    void navigate({
      to: "/search",
      search: {
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(categories.length ? { category: categories } : {}),
        ...(min != null && !isNaN(min) ? { min_price: min } : {}),
        ...(max != null && !isNaN(max) ? { max_price: max } : {}),
        ...(sort !== "relevance" ? { sort } : {}),
        ...(inStockOnly ? { in_stock: true } : {}),
      },
    })
  }

  const activeCount =
    (query.trim() ? 1 : 0) +
    categories.length +
    (minPrice.trim() ? 1 : 0) +
    (maxPrice.trim() ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (sort !== "relevance" ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <DialogHeader className="border-b border-border/80 px-6 py-4 text-left shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <SlidersHorizontal size={20} weight="bold" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                  Filter Search
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Refine results across keyword, departments, price, and stock.
                </DialogDescription>
              </div>
            </div>
            {activeCount > 0 ? (
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-bold text-foreground">
                {activeCount} active
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-none">
          {/* Keyword Search */}
          <div className="space-y-2">
            <label htmlFor="filter-search-input" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Search Keyword
            </label>
            <div className="relative">
              <MagnifyingGlass
                size={18}
                weight="bold"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="filter-search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                className="h-11 w-full rounded-lg border border-border/80 bg-background/80 pl-10 pr-9 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/75 focus:border-primary focus:ring-2 focus:ring-primary/20"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleApply()
                  }
                }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear keyword"
                >
                  <X size={15} weight="bold" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Department / Categories */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Department
              </label>
              {categories.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCategories([])}
                  className="text-xs font-semibold text-primary-strong hover:underline"
                >
                  Clear all ({categories.length})
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">All Departments</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {topCategories.map((category) => {
                const handle = (category.handle || category.id).toLowerCase()
                const isSelected = categories.includes(handle)
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(handle)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-left text-xs font-bold",
                      isSelected
                        ? "border-primary bg-muted text-foreground font-bold shadow-2xs ring-1 ring-primary/40"
                        : "border-border/80 bg-background text-foreground hover:border-primary/50 hover:bg-muted/50",
                    )}
                  >
                    <IconSafe
                      name={iconForCategory(category.name, category.handle)}
                      size={16}
                      className={cn("shrink-0", isSelected ? "text-primary-strong" : "text-muted-foreground")}
                    />
                    <span className="line-clamp-2 leading-tight flex-1">{category.name}</span>
                    {isSelected ? (
                      <Check size={14} weight="bold" className="shrink-0 text-primary-strong" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Price Range (GH₵)
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  GH₵
                </span>
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="h-10 w-full rounded-lg border border-border/80 bg-background/80 pl-11 pr-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-label="Minimum price in Ghana Cedis"
                />
              </div>
              <span className="text-sm font-bold text-muted-foreground">–</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  GH₵
                </span>
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="h-10 w-full rounded-lg border border-border/80 bg-background/80 pl-11 pr-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  aria-label="Maximum price in Ghana Cedis"
                />
              </div>
            </div>

            {/* Quick Price Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRICE_PRESETS.map((preset) => {
                const isMatch =
                  (preset.min != null ? String(preset.min) === minPrice : !minPrice) &&
                  (preset.max != null ? String(preset.max) === maxPrice : !maxPrice)
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.min, preset.max)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                      isMatch
                        ? "border-primary bg-muted text-foreground font-bold shadow-2xs"
                        : "border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Availability
            </label>
            <div>
              <button
                type="button"
                onClick={() => setInStockOnly(!inStockOnly)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left",
                  inStockOnly
                    ? "border-primary bg-muted ring-1 ring-primary/40"
                    : "border-border/80 bg-background hover:bg-muted/50",
                )}
              >
                <Checkbox
                  checked={inStockOnly}
                  onCheckedChange={(c) => setInStockOnly(Boolean(c))}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Package size={15} weight="bold" className="text-primary-strong" />
                    <span>In Stock Only</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Ready for immediate fulfillment
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Sort Results
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SORT_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = sort === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSort(opt.id as any)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-lg border p-2.5 text-center text-xs font-semibold",
                      active
                        ? "border-primary bg-muted text-foreground font-bold ring-1 ring-primary/40 shadow-2xs"
                        : "border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon size={16} weight="bold" />
                    <span className="line-clamp-1">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border/80 px-6 py-3.5 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={activeCount === 0}
            className="text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Reset all
          </Button>

          <Button
            type="button"
            onClick={handleApply}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider shadow-xs hover:brightness-105"
          >
            Apply Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
