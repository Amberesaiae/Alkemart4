import type { HomeSection } from "@alkemart/shared/homepage"
import { Skeleton } from "@/components/skeleton"
import { cn } from "@/lib/utils"

function HeroSkeleton() {
  return <Skeleton className="h-[320px] rounded-3xl sm:h-[380px]" />
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
            <Skeleton className="aspect-square rounded-2xl" />
            <Skeleton className="mx-auto h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </section>
  )
}

function ProductShelfSkeleton({ limit = 4 }: { limit?: number }) {
  return (
    <section aria-hidden="true" className="space-y-4">
      <Skeleton className="h-7 w-36 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: Math.min(limit, 4) }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </section>
  )
}

function PromoGridSkeleton() {
  return (
    <section aria-hidden="true" className="space-y-4">
      <Skeleton className="h-7 w-44 rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="min-h-52 rounded-2xl" />
        <Skeleton className="min-h-52 rounded-2xl" />
      </div>
    </section>
  )
}

function BandSkeleton() {
  return <Skeleton className="h-28 rounded-2xl" />
}

/**
 * Section-aware skeleton: mirrors the managed layout while content loads,
 * following the Walmart order (hero → category tiles → product shelf).
 */
export function HomepageSectionsSkeleton({ sections }: { sections: HomeSection[] }) {
  if (!sections.length) return <HomepageSkeleton />
  return (
    <div className="space-y-8" role="status" aria-label="Loading homepage">
      {sections.map((section) => {
        if (section.type === "promo_hero") return <HeroSkeleton key={section.id} />
        if (section.type === "category_grid") return <CategoryGridSkeleton key={section.id} columns={section.columns} />
        if (section.type === "product_shelf") return <ProductShelfSkeleton key={section.id} limit={section.limit} />
        if (section.type === "promo_band") return <BandSkeleton key={section.id} />
        if (section.type === "promo_grid") return <PromoGridSkeleton key={section.id} />
        return <BandSkeleton key={section.id} />
      })}
      <span className="sr-only">Loading homepage content</span>
    </div>
  )
}

export function HomepageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8", className)} role="status" aria-label="Loading homepage">
      <HeroSkeleton />
      <CategoryGridSkeleton />
      <ProductShelfSkeleton />
      <span className="sr-only">Loading homepage content</span>
    </div>
  )
}
