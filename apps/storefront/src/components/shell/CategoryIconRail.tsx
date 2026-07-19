import { Link } from "@tanstack/react-router"
import type { IconId } from "@/design/icons"
import { IconSafe, categoryIconId } from "@/design/icons"
import { cn } from "@/lib/utils"

export type RailCategory = {
  id: string
  name: string
  handle?: string | null
}

type Props = {
  categories: RailCategory[]
  activeSlug?: string
  className?: string
}

/**
 * Top department rail — EXACT hierarchy:
 *   Electronics · Food · Beverages · Personal Care · Pet Care · Baby Care
 *
 * Layout: icon + label on ONE horizontal line (text BY icon, not beneath).
 * Six only. No "All". ICONPAK2 monoline icons.
 */
const MOWAFER_RAIL: ReadonlyArray<{
  label: string
  handle: string
  icon: IconId
  match: RegExp
}> = [
  {
    label: "Electronics",
    handle: "phones-electronics",
    icon: "cat-electronics",
    match: /electron|phone|tech|gadget|comput|device/,
  },
  {
    label: "Food",
    handle: "food-groceries",
    icon: "cat-food",
    match: /food|groc|agricult|kitchen|cook|spice|oil|rice/,
  },
  {
    label: "Beverages",
    handle: "beverages",
    icon: "cat-beverages",
    match: /bever|drink|water|juice|soda/,
  },
  {
    label: "Personal Care",
    handle: "health-beauty",
    icon: "cat-personal-care",
    match: /beauty|personal|cosmetic|skin|makeup|hygiene|health/,
  },
  {
    label: "Pet Care",
    handle: "pet-care",
    icon: "cat-pet-care",
    match: /pet|animal|\bdog\b|\bcats?\b/,
  },
  {
    label: "Baby Care",
    handle: "baby-kids",
    icon: "cat-baby",
    match: /baby|kid|child|infant|toddler/,
  },
]

function resolveRail(categories: RailCategory[]) {
  return MOWAFER_RAIL.map((slot) => {
    const hit =
      categories.find((c) => (c.handle || "").toLowerCase() === slot.handle) ||
      categories.find((c) =>
        slot.match.test(`${c.name} ${c.handle ?? ""}`.toLowerCase()),
      )
    return {
      id: hit?.id ?? `rail-${slot.handle}`,
      label: slot.label,
      slug: hit?.handle || slot.handle,
      lockedIcon: slot.icon,
    }
  })
}

export function CategoryIconRail({
  categories,
  activeSlug,
  className,
}: Props) {
  const rail = resolveRail(categories)

  return (
    <nav
      aria-label="Departments"
      className={cn("border-b border-border bg-card", className)}
    >
      <div
        className={cn(
          "scrollbar-none mx-auto flex w-full max-w-[1200px] items-center",
          "justify-start gap-1 overflow-x-auto px-4 py-2.5",
          "sm:justify-center sm:gap-1.5 sm:px-6 sm:py-3",
        )}
      >
        {rail.map((c) => (
          <RailItem
            key={c.id}
            slug={c.slug}
            label={c.label}
            iconId={c.lockedIcon}
            active={activeSlug === c.slug}
          />
        ))}
      </div>
    </nav>
  )
}

function RailItem(props: {
  slug: string
  label: string
  iconId: IconId
  active: boolean
}) {
  return (
    <Link
      to="/categories/$slug"
      params={{ slug: props.slug }}
      className={cn(
        /* SINGLE LINE: icon | label side-by-side */
        "group relative flex shrink-0 flex-row items-center gap-2",
        "rounded-full px-3 py-2 transition sm:px-3.5 sm:py-2",
        "hover:bg-muted/60",
        props.active
          ? "bg-muted/80 text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <IconSafe
        name={props.iconId}
        size={22}
        preferAsset
        className="shrink-0"
      />
      <span
        className={cn(
          "whitespace-nowrap text-sm font-medium leading-none",
          props.active && "font-semibold",
        )}
      >
        {props.label}
      </span>
      {/* Quiet active underline under the whole chip */}
      <span
        className={cn(
          "absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full transition",
          props.active ? "bg-primary" : "bg-transparent",
        )}
        aria-hidden
      />
    </Link>
  )
}
