import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, FilterHorizontalIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ProductGrid } from "@/components/commerce/product-grid"
import type { AppliedFacet } from "@/lib/listing/ListingFacets"
import type { StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"

export type SortOption<T extends string> = { value: T; label: string }

/**
 * Listing layout shared by category and search: title + count, sort, filters
 * (sidebar on desktop, sheet on phones), removable chips, grid, load more.
 */
export function ListingShell<T extends string>({
  header,
  belowTitle,
  title,
  countLabel,
  sort,
  sortOptions,
  onSort,
  filters,
  applied,
  onRemoveFacet,
  onClearAll,
  products,
  loading,
  switching,
  hasMore,
  loadingMore,
  onLoadMore,
  empty,
  notice,
  pick,
}: {
  header?: React.ReactNode
  /** Sits directly under the title row (e.g. sub-category chips) — heading first, then ways to narrow. */
  belowTitle?: React.ReactNode
  title: string
  countLabel: string | null
  sort: T
  sortOptions: SortOption<T>[]
  onSort: (v: T) => void
  filters: React.ReactNode
  applied: AppliedFacet[]
  onRemoveFacet: (facet: AppliedFacet) => void
  onClearAll: () => void
  products: StoreProductCard[]
  loading: boolean
  /** Previous results on screen while new ones load. */
  switching?: boolean
  hasMore: boolean
  loadingMore?: boolean
  onLoadMore: () => void
  empty: React.ReactNode
  notice?: React.ReactNode
  /** ⚖ Compare mode: pick buttons on the cards. */
  pick?: React.ComponentProps<typeof ProductGrid>["pick"]
}) {
  return (
    <div className="container-page pt-4 sm:pt-6">
      {header}
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">{filters}</div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
              {countLabel ? <p className="mt-1 text-sm text-muted-foreground">{countLabel}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <HugeiconsIcon icon={FilterHorizontalIcon} data-icon="inline-start" />
                    Filters
                    {applied.length ? <Badge className="ml-1 bg-brand text-brand-foreground">{applied.length}</Badge> : null}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-3xl">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto px-4">{filters}</div>
                  <SheetFooter className="border-t border-border">
                    <Button variant="ghost" onClick={onClearAll} disabled={!applied.length}>
                      Clear all
                    </Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <Select value={sort} onValueChange={(v) => onSort(v as T)}>
                <SelectTrigger className="w-44" aria-label="Sort by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {sortOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {belowTitle ? <div className="-mt-1 mb-4">{belowTitle}</div> : null}

          {applied.length ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {applied.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => onRemoveFacet(a)}
                  aria-label={`Remove ${a.group}: ${a.label}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface py-1.5 pr-2 pl-3 text-xs font-medium hover:bg-muted"
                >
                  <span className="text-muted-foreground">{a.group}:</span> {a.label}
                  <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                </button>
              ))}
              <button type="button" onClick={onClearAll} className="px-2 text-xs font-semibold hover:underline">
                Clear all
              </button>
            </div>
          ) : null}

          {notice}

          {!loading && products.length === 0 ? (
            empty
          ) : (
            <div className={cn("transition-opacity", switching && "opacity-60")} aria-busy={switching || loading || undefined}>
              <h2 className="sr-only">Products</h2>
              <ProductGrid products={products} loading={loading} skeletons={12} className="lg:grid-cols-3 xl:grid-cols-4" pick={pick} />
            </div>
          )}

          {hasMore ? (
            <div className="mt-10 flex justify-center">
              <Button variant="outline" size="xl" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Show more"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
