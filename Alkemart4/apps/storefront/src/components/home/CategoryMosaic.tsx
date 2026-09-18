import { Link } from "@tanstack/react-router"
import { MerchCategoryTileBody, merchCategoryTileClass } from "@workspace/ui"
import type { MosaicTile } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

type Props = {
  tiles: MosaicTile[]
  className?: string
}

/**
 * Home category mosaic — the code-defined composition, now drawn with the same
 * primitives as the studio-managed `category_grid` so the two never drift.
 * Tiles come from resolveMosaicTiles (real categories + real photography).
 *
 * Mobile: 2×2 equal tiles
 * lg+: two feature tiles beside a stack of two
 */
export function CategoryMosaic({ tiles, className }: Props) {
  if (!tiles.length) return null
  return (
    <section className={cn("space-y-3", className)} aria-labelledby="mosaic-heading">
      <div className="flex items-end justify-between gap-2">
        <h2 id="mosaic-heading" className="type-section text-foreground">
          Shop by category
        </h2>
        <Link
          to="/categories/$slug"
          params={{ slug: "all" }}
          className="type-sm font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                feature={feature}
                variant="mosaic"
                ratio="landscape"
              />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
