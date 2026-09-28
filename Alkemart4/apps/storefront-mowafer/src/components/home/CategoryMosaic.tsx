import { Link } from "@tanstack/react-router"
import { MerchCategoryTileBody, MerchEmpty, merchCategoryTileClass } from "@workspace/ui"
import type { MosaicTile } from "@/lib/catalog-nav"
import { deptAccentClass } from "@/lib/catalog-nav"
import { MosaicSkeleton } from "@/components/skeletons"
import { cn } from "@/lib/utils"

type Props = {
  tiles: MosaicTile[]
  loading?: boolean
  className?: string
}

export function CategoryMosaic({ tiles, loading, className }: Props) {
  if (loading) {
    return (
      <div data-testid="section-mosaic" className={className}>
        <MosaicSkeleton />
      </div>
    )
  }
  if (!tiles.length) {
    return (
      <section data-testid="section-mosaic" aria-labelledby="mosaic-heading" className={className}>
        <h2 id="mosaic-heading" className="mb-3 text-2xl font-bold tracking-tight">
          Shop by category
        </h2>
        <MerchEmpty title="No categories yet" body="Departments appear here when the catalog publishes them." />
      </section>
    )
  }

  return (
    <section
      data-testid="section-mosaic"
      className={cn("space-y-3", className)}
      aria-labelledby="mosaic-heading"
    >
      <div className="flex items-end justify-between gap-2">
        <h2 id="mosaic-heading" className="text-2xl font-bold tracking-tight text-foreground">
          Shop by category
        </h2>
        <Link
          to="/categories/$slug"
          params={{ slug: "all" }}
          className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:h-[min(440px,50vw)] lg:min-h-[420px] lg:grid-cols-3 lg:grid-rows-2 lg:gap-4">
        {tiles.map((slot, index) => {
          const feature = index < 2
          return (
            <Link
              key={slot.id}
              to="/categories/$slug"
              params={{ slug: slot.slug }}
              aria-label={`Browse ${slot.title}`}
              className={merchCategoryTileClass({ variant: "mosaic", ratio: "landscape", feature })}
            >
              <MerchCategoryTileBody
                label={slot.title}
                imageUrl={slot.photo}
                imageClassName={slot.objectPos}
                variant="mosaic"
                ratio="landscape"
                fallback={
                  <span
                    className={cn(
                      "flex h-full w-full items-center justify-center text-sm font-bold",
                      deptAccentClass(slot.title, slot.slug),
                    )}
                  >
                    {slot.title}
                  </span>
                }
              />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
