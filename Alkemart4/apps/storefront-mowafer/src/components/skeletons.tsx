import { Skeleton } from "@workspace/ui"
import { cn } from "@/lib/utils"

/**
 * Shared loading atoms — squircle-first (rounded-2xl cards, rounded-xl
 * inners, rounded-full pills). Every route shows these instead of bare
 * "Loading…" text so a full navigation proves its shimmer states.
 */

export function ProductCardSkeleton({
  size = "tile",
  className,
}: {
  size?: "tile" | "row"
  className?: string
}) {
  if (size === "row") {
    return (
      <div className={cn("flex gap-3 rounded-2xl border border-border bg-card p-3", className)}>
        <Skeleton className="size-20 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2 py-1">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
        <Skeleton className="size-9 shrink-0 self-center rounded-full" />
      </div>
    )
  }
  return (
    <div className={cn("space-y-2.5 rounded-2xl border border-border bg-card p-3", className)}>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="size-9 rounded-full" />
      </div>
    </div>
  )
}

export function ProductGridSkeleton({
  count = 8,
  view = "grid",
  className,
}: {
  count?: number
  view?: "grid" | "list"
  className?: string
}) {
  if (view === "list") {
    return (
      <div className={cn("grid gap-2.5 sm:grid-cols-2", className)} role="status" aria-label="Loading products">
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} size="row" />
        ))}
      </div>
    )
  }
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} size="tile" />
      ))}
    </div>
  )
}

export function MosaicSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading categories">
      <Skeleton className="h-8 w-48 rounded-md" />
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:h-[min(440px,50vw)] lg:min-h-[420px] lg:grid-cols-3 lg:grid-rows-2 lg:gap-4">
        <Skeleton className="min-h-40 rounded-2xl lg:row-span-2" />
        <Skeleton className="min-h-40 rounded-2xl lg:row-span-2" />
        <Skeleton className="min-h-40 rounded-2xl" />
        <Skeleton className="min-h-40 rounded-2xl" />
      </div>
    </div>
  )
}

export function RailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-2 overflow-hidden py-1", className)} role="status" aria-label="Loading departments">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function ShopCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-0 overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-5 w-2/3 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
    </div>
  )
}

export function ShopGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)} role="status" aria-label="Loading shops">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <ShopCardSkeleton />
        </li>
      ))}
    </ul>
  )
}

export function FilterSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)} role="status" aria-label="Loading filters">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PDPDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8", className)} role="status" aria-label="Loading product">
      <Skeleton className="h-4 w-64 rounded-md" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div className="space-y-3">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="size-16 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4 rounded-md" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function CartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-8 lg:grid-cols-[1fr_280px]", className)} role="status" aria-label="Loading cart">
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <Skeleton className="size-16 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 rounded-md" />
              <Skeleton className="h-3 w-1/4 rounded-md" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        ))}
      </div>
      <div className="h-fit space-y-2 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-6 w-full rounded-md" />
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  )
}

export function OrderCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-3 w-56 rounded-md" />
        </div>
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
    </div>
  )
}

export function PeerOffersSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-2xl border border-border bg-card p-4", className)} role="status" aria-label="Loading offers">
      <Skeleton className="h-5 w-40 rounded-md" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 rounded-xl p-2.5">
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
        </div>
      ))}
    </div>
  )
}
