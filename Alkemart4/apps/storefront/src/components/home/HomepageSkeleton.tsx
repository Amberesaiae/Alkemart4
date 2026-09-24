import type { HomeSection } from "@alkemart/shared/homepage"
import { Skeleton } from "@/components/skeleton"
import { CategoryRailSkeleton } from "@/components/shell/CategoryIconRail"
import {
  DealTabsSkeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  Shimmer,
  ShelfSkeleton,
  StoreRailSkeleton,
} from "@/components/skeleton"
import { PRODUCT_GRID_CLASS } from "@/components/product-grid"
import { cn } from "@/lib/utils"

/**
 * Homepage loading states, per beat.
 *
 * Each placeholder mirrors the real section it stands in for — the mosaic's
 * hero + two-small + wide composition, a shelf's card row and header chrome,
 * the deal hub's tab strip over a card grid. The sections never change height
 * when data lands, which is what stops the page from lurching as it loads.
 */
function CategoryMosaicSkeleton() {
  return (
    <section aria-hidden="true" className="w-full">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5 lg:grid-rows-2 lg:h-[420px] lg:gap-3.5">
        <Shimmer className="col-span-2 aspect-[16/10] rounded-lg lg:col-span-3 lg:row-span-2 lg:aspect-auto lg:h-full" />
        <Shimmer className="col-span-1 aspect-square rounded-lg sm:aspect-[4/3] lg:aspect-auto lg:h-full" />
        <Shimmer className="col-span-1 aspect-square rounded-lg sm:aspect-[4/3] lg:aspect-auto lg:h-full" />
        <Shimmer className="col-span-2 aspect-[16/9] rounded-lg sm:aspect-[21/9] lg:col-span-2 lg:aspect-auto lg:h-full" />
      </div>
    </section>
  )
}

/** The Deals of the day hub: department tabs over a grid of deal cards. */
function DealsHubSkeleton() {
  return (
    <section aria-hidden="true" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Shimmer className="h-3 w-20 rounded-sm" />
          <Shimmer className="h-6 w-44 rounded-lg sm:w-56" />
          <Shimmer className="h-3.5 w-56 rounded-md sm:w-80" />
        </div>
        <Shimmer className="h-5 w-20 rounded-md" />
      </div>
      <DealTabsSkeleton />
      <div className={PRODUCT_GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}

function CategoryGridSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <section aria-hidden="true" className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-5 w-16 rounded-lg" />
      </div>
      <div className={cn("grid grid-cols-2 gap-3", columns >= 6 ? "sm:grid-cols-6" : "sm:grid-cols-4")}>
        {Array.from({ length: Math.min(columns, 6) }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Shimmer className="aspect-square rounded-lg" />
            <Shimmer className="mx-auto h-4 w-3/4" />
          </div>
        ))}
      </div>
    </section>
  )
}

function PromoGridSkeleton() {
  return (
    <section aria-hidden="true" className="space-y-4">
      <Shimmer className="h-7 w-44 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Shimmer className="min-h-52 rounded-lg" />
        <Shimmer className="min-h-52 rounded-lg" />
        <Shimmer className="min-h-52 rounded-lg" />
      </div>
    </section>
  )
}

function ShelfFallback({ section }: { section: HomeSection }) {
  if (section.type === "category_grid") {
    return section.variant === "mosaic" ? <CategoryMosaicSkeleton /> : <CategoryGridSkeleton columns={section.columns} />
  }
  if (section.type === "store_rail") return <StoreRailSkeleton />
  if (section.type === "deal_rail") return section.variant === "tabs" ? <DealsHubSkeleton /> : <ShelfSkeleton count={4} />
  if (section.type === "product_shelf") {
    return section.layout === "grid" ? (
      <div className="space-y-3.5">
        <Shimmer className="h-6 w-44 rounded-lg" />
        <ProductGridSkeleton count={Math.min(section.limit, 8)} />
      </div>
    ) : (
      <ShelfSkeleton count={Math.min(section.limit, 5)} />
    )
  }
  if (section.type === "promo_grid") return <PromoGridSkeleton />
  if (section.type === "promo_band" || section.type === "countdown_banner") {
    return <Shimmer className="h-28 rounded-lg" />
  }
  if (section.type === "promo_hero") return <Shimmer className="h-[320px] rounded-lg sm:h-[380px]" />
  if (section.type === "marquee") return <Shimmer className="h-12 rounded-lg" />
  return null
}

/**
 * The page's opening screen while /store/homepage-content is in flight: the
 * course's own beats, in the course's own order.
 */
export function HomepageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8 sm:space-y-12", className)} role="status" aria-label="Loading homepage">
      <CategoryMosaicSkeleton />
      <ShelfSkeleton count={5} />
      <DealsHubSkeleton />
      <ShelfSkeleton count={5} />
      <StoreRailSkeleton />
      <span className="sr-only">Loading homepage content</span>
    </div>
  )
}

/**
 * In-page fallback for a known course. Rendering the real section list keeps
 * the placeholder honest when Studio publishes a page we have not seen.
 */
export function HomepageSectionsSkeleton({ sections }: { sections?: HomeSection[] }) {
  const beats = sections?.length ? sections : null
  if (!beats) return <HomepageSkeleton />
  return (
    <div className="space-y-8 sm:space-y-12" role="status" aria-label="Loading homepage">
      {beats.map((section) => (
        <ShelfFallback key={section.id} section={section} />
      ))}
      <span className="sr-only">Loading homepage content</span>
    </div>
  )
}
