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

/**
 * Mirrors ProductCard footprint exactly:
 * aspect-square image + min-h body (title / seller / price / CTA).
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className={PRODUCT_GRID_CLASS}
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex h-full flex-col overflow-hidden border border-border bg-card"
        >
          <Skeleton className="aspect-square w-full shrink-0 rounded-none" />
          <div className="flex min-h-[9.5rem] flex-1 flex-col gap-2 p-3">
            <div className="min-h-[2.75rem] space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded-none" />
              <Skeleton className="h-3.5 w-4/5 rounded-none" />
            </div>
            <div className="min-h-[1rem]">
              <Skeleton className="h-3 w-1/2 rounded-none" />
            </div>
            <div className="min-h-[1.25rem]">
              <Skeleton className="h-4 w-1/3 rounded-none" />
            </div>
            <div className="mt-auto">
              <Skeleton className="h-11 w-full rounded-none" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
