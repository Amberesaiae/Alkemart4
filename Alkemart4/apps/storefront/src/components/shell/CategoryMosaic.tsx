import { Link } from "@tanstack/react-router"
import type { MosaicTile } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

type Props = {
  tiles: MosaicTile[]
  className?: string
}

/**
 * Full-bleed category mosaic driven by canonical mosaic art.
 * Tiles come from resolveMosaicTiles (real categories + real photography).
 */
export function CategoryMosaic({ tiles, className }: Props) {
  return (
    <section className={cn(className)} aria-label="Shop by category">
      <div
        className={cn(
          "grid gap-3 sm:gap-3.5",
          "grid-cols-2",
          "lg:grid-cols-3 lg:grid-rows-2",
          "lg:h-[min(440px,50vw)] lg:min-h-[420px]",
        )}
      >
        {tiles.map((slot, i) => (
          <Tile
            key={slot.id}
            slot={slot}
            tall={i < 2}
            className={
              i < 2
                ? "min-h-[240px] sm:min-h-[280px] lg:row-span-2 lg:min-h-0"
                : "min-h-[180px] sm:min-h-[200px] lg:min-h-0"
            }
          />
        ))}
      </div>
    </section>
  )
}

function Tile({
  slot,
  className,
  tall,
}: {
  slot: MosaicTile
  className?: string
  tall?: boolean
}) {
  return (
    <Link
      to="/categories/$slug"
      params={{ slug: slot.slug }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-muted",
        "shadow-sm ring-1 ring-black/[0.04]",
        "transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <img
        src={slot.photo}
        alt=""
        width={1400}
        height={1400}
        decoding="async"
        loading="eager"
        className={cn(
          "absolute inset-0 z-0 h-full w-full object-cover",
          "transition duration-500 group-hover:scale-[1.03]",
          slot.objectPos,
        )}
        draggable={false}
        style={{ backgroundColor: "var(--muted)" }}
      />

      <span
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          tall ? "mosaic-scrim-tall" : "mosaic-scrim-short",
        )}
        aria-hidden
      />

      <div
        className={cn(
          "relative z-10 text-white",
          tall ? "p-5 sm:p-6 lg:p-7" : "p-4 sm:p-5",
        )}
      >
        <h2
          className={cn(
            "font-extrabold uppercase leading-none tracking-[0.03em]",
            "whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]",
            tall
              ? "text-[15px] sm:text-lg lg:text-[21px] xl:text-[24px]"
              : "text-[12px] sm:text-sm lg:text-[15px] xl:text-base",
          )}
        >
          {slot.title}
        </h2>
        {tall ? (
          <p className="mt-2.5 max-w-[13rem] text-[11px] font-medium leading-snug text-white/90 sm:mt-3 sm:max-w-[15rem] sm:text-xs">
            Shop top picks from trusted sellers — compare prices in one place.
          </p>
        ) : null}
      </div>
    </Link>
  )
}
