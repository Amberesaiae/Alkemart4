import { Skeleton } from "@/components/skeleton"
import { cn } from "@/lib/utils"

export function HomepageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-8", className)} role="status" aria-label="Loading homepage">
      <Skeleton className="h-[320px] rounded-3xl sm:h-[380px]" />
      <section aria-hidden="true" className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-5 w-16 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square rounded-2xl" />
              <Skeleton className="mx-auto h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      </section>
      <section aria-hidden="true" className="space-y-4">
        <Skeleton className="h-7 w-36 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </section>
      <span className="sr-only">Loading homepage content</span>
    </div>
  )
}
