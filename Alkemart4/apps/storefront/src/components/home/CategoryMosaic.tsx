import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { merchCategoryTileClass } from "@workspace/ui"
import type { MosaicTile } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

type Props = {
  tiles: MosaicTile[]
  className?: string
}

// Promotional rotation images per category handle (fresh art — the previous
// electronics/food/fashion/cosmetics set is retired from the mosaic).
const ROTATION_SETS: Record<string, string[]> = {
  "phones-electronics": [
    "/images/categories/generated/electronics-v3.webp",
  ],
  "health-beauty": [
    "/images/categories/generated/beauty-v3.webp",
  ],
  "food-groceries": [
    "/images/categories/generated/groceries-v3.webp",
  ],
  "fashion-apparel": [
    "/images/categories/generated/fashion-v3.webp",
  ],
}

// Staggered intervals so images never rotate simultaneously
const ROTATION_INTERVALS = [4500, 6200, 5400, 7100, 5800]

function DynamicMosaicTile({
  slot,
  intervalMs,
}: {
  slot: MosaicTile
  intervalMs: number
}) {
  const images =
    ROTATION_SETS[slot.slug] && ROTATION_SETS[slot.slug].length > 1
      ? ROTATION_SETS[slot.slug]
      : [slot.photo]

  const [activeIdx, setActiveIdx] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (images.length <= 1 || isHovered) return

    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % images.length)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [images.length, intervalMs, isHovered])

  return (
    <Link
      to="/categories/$slug"
      params={{ slug: slot.slug }}
      aria-label={`Shop ${slot.title}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative block h-full w-full overflow-hidden rounded-lg bg-black/5 ring-1 ring-black/[0.06] shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="relative h-full w-full aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto overflow-hidden">
        {/* Hard swap, not a crossfade: two art layers compositing at rest
            ghosted the outgoing photo into the incoming one. The incoming
            image must already be decoded before it becomes visible, so the
            swap is instant and never shows a blend of both. */}
        {images.map((src, i) => {
          const nextIdx = (activeIdx + 1) % images.length
          return (
            <img
              key={src}
              src={src}
              alt=""
              width={1000}
              height={1000}
              decoding="async"
              loading={i === activeIdx || i === nextIdx ? "eager" : "lazy"}
              draggable={false}
              className={cn(
                "absolute inset-0 h-full w-full object-cover",
                slot.objectPos,
                i === activeIdx ? "visible" : "invisible",
              )}
            />
          )
        })}

        {images.length > 1 ? (
          <div className="absolute bottom-3 right-3 z-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 backdrop-blur-xs">
            {images.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full",
                  i === activeIdx ? "w-3 bg-white" : "w-1.5 bg-white/50",
                )}
              />
            ))}
          </div>
        ) : null}

      </div>
    </Link>
  )
}

/**
 * Mowafer-shaped mosaic: two tall category cards plus two stacked cards.
 * The overlay title (API category name) + gold "Shop now" names each link;
 * the wide slot falls to health-beauty/cosmetics exactly like the art brief.
 */
export function CategoryMosaic({ tiles, className }: Props) {
  if (!tiles.length) return null

  // hero + 2 small + 1 wide (health-beauty fourth in resolve order)
  const hero = tiles[0]
  const smallA = tiles[1]
  const smallB = tiles[2]
  const wide = tiles[3]

  return (
    <section className={cn("w-full", className)} aria-label="Featured Categories">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-6 lg:grid-rows-2 lg:h-[440px] lg:gap-3.5">
        {hero ? (
          <div className="col-span-2 aspect-[16/10] lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-full">
            <DynamicMosaicTile
              slot={hero}
              intervalMs={ROTATION_INTERVALS[0]}
            />
          </div>
        ) : null}

        {smallA ? (
          <div className="col-span-1 aspect-square sm:aspect-[4/3] lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-full">
            <DynamicMosaicTile
              slot={smallA}
              intervalMs={ROTATION_INTERVALS[1]}
            />
          </div>
        ) : null}

        {smallB ? (
          <div className="col-span-1 aspect-square sm:aspect-[4/3] lg:col-span-2 lg:aspect-auto lg:h-full">
            <DynamicMosaicTile
              slot={smallB}
              intervalMs={ROTATION_INTERVALS[2]}
            />
          </div>
        ) : null}

        {wide ? (
          <div className="col-span-2 aspect-[16/9] sm:aspect-[21/9] lg:col-span-2 lg:row-span-1 lg:aspect-auto lg:h-full">
            <DynamicMosaicTile
              slot={wide}
              intervalMs={ROTATION_INTERVALS[3]}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
