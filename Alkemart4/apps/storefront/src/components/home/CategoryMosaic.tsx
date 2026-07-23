import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

export type MosaicCategory = {
  id: string
  name: string
  handle?: string | null
}

type Props = {
  categories: MosaicCategory[]
  className?: string
  /** @deprecated slots are fixed to 4; kept for call-site compat */
  limit?: number
}

/**
 * Home category mosaic — compact bento, aspect-ratio driven (no fixed 420px towers).
 *
 * Mobile: 2×2 equal tiles
 * lg+: Pets | Food | Cosmetics/Electronics stack
 *
 * No inline styles. Accessible names on every tile. Focus-visible rings.
 */
const MOSAIC_SLOTS = [
  {
    key: "pets",
    title: "Pet Care",
    handle: "pet-care",
    photo: "/images/categories/pets.webp",
    objectPos: "object-[center_20%]",
    match: /pet|animal|\bdog\b|\bcats?\b/,
    tall: true,
  },
  {
    key: "food",
    title: "Food",
    handle: "food-groceries",
    photo: "/images/categories/food.webp",
    objectPos: "object-center",
    match: /food|groc|agricult|kitchen|cook/,
    tall: true,
  },
  {
    key: "cosmetics",
    title: "Personal Care",
    handle: "health-beauty",
    photo: "/images/categories/cosmetics.webp",
    objectPos: "object-[center_25%]",
    match: /beauty|personal|cosmetic|skin|makeup|hygiene|health/,
    tall: false,
  },
  {
    key: "electronics",
    title: "Electronics",
    handle: "phones-electronics",
    photo: "/images/categories/electronics.webp",
    objectPos: "object-center",
    match: /electron|phone|tech|gadget|comput|device/,
    tall: false,
  },
] as const

function resolveSlots(categories: MosaicCategory[]) {
  return MOSAIC_SLOTS.map((slot) => {
    const hit =
      categories.find((c) => (c.handle || "").toLowerCase() === slot.handle) ||
      categories.find((c) =>
        slot.match.test(`${c.name} ${c.handle ?? ""}`.toLowerCase()),
      )
    return {
      ...slot,
      id: hit?.id ?? `mosaic-${slot.key}`,
      slug: hit?.handle || slot.handle,
    }
  })
}

export function CategoryMosaic({ categories, className }: Props) {
  const tiles = resolveSlots(categories)
  const [pets, food, cosmetics, electronics] = tiles

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

      <div
        className={cn(
          "mosaic-grid",
          "grid grid-cols-2 gap-2.5 sm:gap-3",
          "lg:grid-cols-3 lg:grid-rows-2 lg:gap-4",
        )}
      >
        <Tile slot={pets} className="lg:row-span-2" />
        <Tile slot={food} className="lg:row-span-2" />
        <Tile slot={cosmetics} />
        <Tile slot={electronics} />
      </div>
    </section>
  )
}

type Slot = ReturnType<typeof resolveSlots>[number]

function Tile({
  slot,
  className,
}: {
  slot: Slot
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
            "inline-block max-w-full truncate rounded-md bg-black/75 px-2 py-1",
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
