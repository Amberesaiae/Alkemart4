import { Link } from "@tanstack/react-router"
import type { MosaicTile } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

type Props = {
  tiles: MosaicTile[]
  className?: string
}

/**
 * Home category mosaic — compact bento driven by canonical mosaic art.
 * Tiles come from resolveMosaicTiles (real categories + real photography).
 *
 * Mobile: 2×2 equal tiles
 * lg+: Pets | Food | Cosmetics/Electronics stack
 *
 * No inline styles. Accessible names on every tile. Focus-visible rings.
 */
export function CategoryMosaic({ tiles, className }: Props) {
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

      {tiles.length ? (
        <div
          className={cn(
            "mosaic-grid",
            "grid grid-cols-2 gap-2.5 sm:gap-3",
            "lg:grid-cols-3 lg:grid-rows-2 lg:gap-4",
          )}
        >
          {tiles.map((slot, i) => (
            <Tile
              key={slot.id}
              slot={slot}
              className={i < 2 ? "lg:row-span-2" : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Tile({
  slot,
  className,
}: {
  slot: MosaicTile
  className?: string
}) {
  return (
    <Link
      to="/categories/$slug"
      params={{ slug: slot.slug }}
      aria-label={`Browse ${slot.title}`}
      className={cn(
        "mosaic-tile group relative flex flex-col justify-end overflow-hidden rounded-xl bg-muted",
        "ring-1 ring-black/[0.06] shadow-sm",
        "transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "motion-reduce:transition-none",
        slot.tall ? "mosaic-tile-tall" : "mosaic-tile-short",
        className,
      )}
    >
      <img
        src={slot.photo}
        alt=""
        width={800}
        height={800}
        decoding="async"
        loading="lazy"
        draggable={false}
        className={cn(
          "absolute inset-0 z-0 h-full w-full object-cover bg-muted",
          "transition duration-300 group-hover:scale-[1.03]",
          "motion-reduce:transition-none motion-reduce:group-hover:scale-100",
          slot.objectPos,
        )}
      />

      <span
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          slot.tall ? "mosaic-scrim-tall" : "mosaic-scrim-short",
        )}
        aria-hidden="true"
      />

      <div className="relative z-10 p-3 sm:p-3.5">
        <span
          className={cn(
            "inline-block max-w-full truncate rounded-md bg-[#1a1510]/85 px-2 py-1",
            "text-sm font-bold tracking-tight text-white backdrop-blur-[2px]",
            "sm:text-base lg:text-lg lg:px-3 lg:py-1.5",
          )}
        >
          {slot.title}
        </span>
      </div>
    </Link>
  )
}
