import { cn } from "@/lib/utils"
import { PRODUCT_GRID_CLASS } from "@/components/product-grid"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
    />
  )
}

const cardShell =
  "overflow-hidden rounded-lg border border-border bg-card shadow-sm"

/** Matches ProductCard size="tile" — square media + tight body */
function TileSkel({ className }: { className?: string }) {
  return (
    <div className={cn(cardShell, "flex h-full flex-col", className)}>
      <Skeleton className="aspect-square w-full shrink-0 rounded-none" />
      <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="mt-0.5 h-2.5 w-1/2" />
        <div className="mt-auto flex items-center justify-between pt-1">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
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
