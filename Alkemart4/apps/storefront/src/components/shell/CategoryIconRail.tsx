import { Link } from "@tanstack/react-router"
import type { IconId } from "@/design/icons"
import { IconSafe } from "@/design/icons"
import { iconForCategory } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

export type RailCategory = {
  id: string
  name: string
  handle?: string | null
  icon: IconId
}

type Props = {
  categories: RailCategory[]
  activeSlug?: string
  className?: string
}

/**
 * Top department rail — short list of top-level departments only.
 * Subcategories belong on the PLP, not here.
 */
function resolveRail(categories: RailCategory[]) {
  return categories.map((c) => ({
    id: c.id,
    label: c.name,
    slug: c.handle || c.id,
    lockedIcon: c.icon ?? iconForCategory(c.name, c.handle),
  }))
}

export function CategoryIconRail({
  categories,
  activeSlug,
  className,
}: Props) {
  const rail = resolveRail(categories)
  if (!rail.length) return null

  return (
    <nav
      aria-label="Departments"
      className={cn("border-b border-border bg-card", className)}
    >
      <div className="relative mx-auto w-full max-w-[1200px]">
        {/* Edge fades hint that the row can scroll on small screens */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card to-transparent sm:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-card to-transparent sm:hidden"
          aria-hidden
        />
        <div
          className={cn(
            "scrollbar-none flex w-full items-center",
            "justify-start gap-1 overflow-x-auto px-4 py-2.5",
            "sm:justify-center sm:flex-wrap sm:gap-1.5 sm:overflow-visible sm:px-6 sm:py-3",
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
        "group relative flex shrink-0 flex-row items-center gap-1.5",
        "rounded-full px-2.5 py-1.5 transition sm:gap-2 sm:px-3 sm:py-2",
        "hover:bg-muted/60",
        props.active
          ? "bg-muted/80 text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <IconSafe
        name={props.iconId}
        size={20}
        preferAsset
        className="shrink-0"
      />
      <span
        className={cn(
          "max-w-[9.5rem] truncate whitespace-nowrap text-sm font-medium leading-none sm:max-w-none",
          props.active && "font-semibold",
        )}
      >
        {props.label}
      </span>
      <span
        className={cn(
          "absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full transition sm:inset-x-3",
          props.active ? "bg-primary" : "bg-transparent",
        )}
        aria-hidden
      />
    </Link>
  )
}
