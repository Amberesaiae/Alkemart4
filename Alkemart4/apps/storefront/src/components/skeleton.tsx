import { cn } from "@/lib/utils"
import { PRODUCT_GRID_CLASS } from "@/components/product-grid"

/**
 * A loading placeholder block.
 *
 * Two different things use this file, and they should not be confused:
 * `.merch-shimmer` is for *content* that is being fetched (art, cards), and it
 * reads as a light sweeping across a surface. `animate-pulse` is for structural
 * chrome. A shelf that is about to hold cards gets the sweep, because the sweep
 * is the signal buyers already read as "loading", and a flat pulse of identical
 * grey boxes reads as a broken page.
 *
 * Geometry matters more than colour: every skeleton here mirrors the real
 * component's boxes (2-line title, seller line, price line, rating line), so
 * nothing jumps when the data lands. Placeholders are still blocks — never
 * animated (e-commerce is read, not watched).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-md bg-black/[0.055] dark:bg-white/[0.08]", className)}
      aria-hidden
    />
  )
}

/** Content placeholder — the sweeping shimmer, not a pulse. */
export function Shimmer({ className }: { className?: string }) {
  return <div className={cn("merch-shimmer rounded-md", className)} aria-hidden />
}

const cardShell = "overflow-hidden rounded-lg border border-border bg-card shadow-sm"

/**
 * Matches Alkemart ProductCard — square rounded-2xl art, with 4-line outside text hierarchy:
 * 1. Product title
 * 2. Vendor name
 * 3. Price figure
 * 4. Star rating
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full w-full flex-col text-left", className)} aria-hidden>
      <Shimmer className="aspect-square w-full shrink-0 rounded-lg bg-muted/20 dark:bg-muted/40" />
      <div className="flex flex-1 flex-col pt-2.5 pb-1 gap-1.5 min-w-0">
        <Shimmer className="h-4 sm:h-5 w-3/4 rounded-md" />
        <Shimmer className="h-4 sm:h-5 w-1/2 rounded-md" />
        <Shimmer className="h-4 sm:h-5 w-1/3 rounded-md" />
        <Shimmer className="h-4 sm:h-5 w-1/4 rounded-md" />
      </div>
    </div>
  )
}

/** Matches ProductCard size="tile" */
function TileSkel({ className }: { className?: string }) {
  return <ProductCardSkeleton className={className} />
}

/** One horizontal shelf of store cards — header chrome plus the card row. */
export function ShelfSkeleton({
  count = 5,
  layout = "carousel",
  className,
}: {
  count?: number
  layout?: "carousel" | "grid"
  className?: string
}) {
  if (layout === "grid") {
    return (
      <div className={cn(PRODUCT_GRID_CLASS, className)} role="status" aria-label="Loading products">
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  }
  return (
    <div className={cn("space-y-3.5", className)} role="status" aria-label="Loading products">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Shimmer className="h-6 w-40 rounded-lg sm:w-52" />
          <Shimmer className="h-3.5 w-56 rounded-md sm:w-72" />
        </div>
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="scrollbar-none flex gap-3 overflow-x-hidden pb-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[calc((100vw-3.25rem)/2)] max-w-[224px] shrink-0 sm:w-56">
            <ProductCardSkeleton />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading products</span>
    </div>
  )
}

/** Store card placeholder — 16/9 cover, shop name, rating/delivery facts. */
export function StoreCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col text-left", className)} aria-hidden>
      <Shimmer className="aspect-[16/10] w-full rounded-lg bg-muted/20 dark:bg-muted/40" />
      <div className="flex flex-col gap-1.5 pt-2.5">
        <div className="flex items-center justify-between">
          <Shimmer className="h-4 sm:h-5 w-3/5 rounded-md" />
          <Shimmer className="h-4 w-5 rounded-full" />
        </div>
        <div className="flex items-center gap-3 pt-0.5">
          <Shimmer className="h-3.5 w-16 rounded-md" />
          <Shimmer className="h-3.5 w-24 rounded-md" />
        </div>
      </div>
    </div>
  )
}

/** One horizontal rail of shop cards. */
export function StoreRailSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3.5", className)} role="status" aria-label="Loading stores">
      <div className="space-y-1.5">
        <Shimmer className="h-6 w-40 rounded-lg sm:w-52" />
        <Shimmer className="h-3.5 w-56 rounded-md sm:w-72" />
      </div>
      <div className="scrollbar-none flex gap-3.5 overflow-x-hidden pb-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-72 sm:w-80 md:w-[22rem] shrink-0">
            <StoreCardSkeleton />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading stores</span>
    </div>
  )
}

/** Department tab strip placeholder for the Deals of the day hub. */
export function DealTabsSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-hidden", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex shrink-0 flex-col items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2.5 sm:min-w-24"
        >
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-3 w-14 rounded-md" />
        </div>
      ))}
    </div>
  )
}

/**
 * Last Offers skeleton — same 4-up grid as live cards.
 */
export function LastOffersSkeleton({
  count = 8,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(PRODUCT_GRID_CLASS, className)}
      role="status"
      aria-label="Loading last offers"
    >
      {Array.from({ length: count }).map((_, i) => (
        <TileSkel key={i} />
      ))}
    </div>
  )
}

/** PLP / search / store / related — same 4-up tile skeleton */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className={PRODUCT_GRID_CLASS}
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <TileSkel key={i} />
      ))}
    </div>
  )
}

/** Store catalog skeleton — matches Hubtel 5-column retail card geometry (Image 1). */
export function StoreProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4"
      role="status"
      aria-label="Loading store products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
