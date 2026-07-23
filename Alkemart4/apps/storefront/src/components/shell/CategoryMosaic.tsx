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
  limit?: number
}

/**
 * Mowafer imgi_10 category mosaic — full-bleed photography only (no color panels).
 * Assets: public/images/categories/*.webp from ui/categories (high-res WebP).
 *
 *   Pets (tall) | Food (tall) | Cosmetics (short)
 *               |             | Electronics (short)
 *
 * Title is ONE line over the image with a light gradient for legibility.
 */
const MOSAIC_SLOTS = [
  {
    key: "pets",
    title: "Pets Care Category",
    handle: "pet-care",
    photo: "/images/categories/pets.webp",
    objectPos: "object-[center_15%]",
    match: /pet|animal|\bdog\b|\bcats?\b/,
  },
  {
    key: "food",
    title: "Food Category",
    handle: "food-groceries",
    photo: "/images/categories/food.webp",
    objectPos: "object-center",
    match: /food|groc|agricult|kitchen|cook/,
  },
  {
    key: "cosmetics",
    title: "Cosmetics Category",
    handle: "health-beauty",
    photo: "/images/categories/cosmetics.webp",
    objectPos: "object-[center_20%]",
    match: /beauty|personal|cosmetic|skin|makeup|hygiene|health/,
  },
  {
    key: "electronics",
    title: "Electronics Category",
    handle: "phones-electronics",
    photo: "/images/categories/electronics.webp",
    objectPos: "object-center",
    match: /electron|phone|tech|gadget|comput|device/,
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
    <section className={cn(className)} aria-label="Shop by category">
      <div
        className={cn(
          "grid gap-3 sm:gap-3.5",
          "grid-cols-2",
          "lg:grid-cols-3 lg:grid-rows-2",
          "lg:h-[min(440px,50vw)] lg:min-h-[420px]",
        )}
      >
        <Tile
          slot={pets}
          tall
          className="min-h-[240px] sm:min-h-[280px] lg:row-span-2 lg:min-h-0"
        />
        <Tile
          slot={food}
          tall
          className="min-h-[240px] sm:min-h-[280px] lg:row-span-2 lg:min-h-0"
        />
        <Tile
          slot={cosmetics}
          className="min-h-[180px] sm:min-h-[200px] lg:min-h-0"
        />
        <Tile
          slot={electronics}
          className="min-h-[180px] sm:min-h-[200px] lg:min-h-0"
        />
      </div>
    </section>
  )
}

type Slot = ReturnType<typeof resolveSlots>[number]

function Tile({
  slot,
  className,
  tall,
}: {
  slot: Slot
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
      {/* Full-bleed high-res WebP — no color panel */}
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

      {/* Soft scrim — CSS classes, no inline gradient */}
      <span
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          tall ? "mosaic-scrim-tall" : "mosaic-scrim-short",
        )}
        aria-hidden
      />

      {/* Title — SINGLE LINE over photo */}
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
