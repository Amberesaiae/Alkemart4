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
 * Top department rail — every real marketplace category in rank order.
 * Rows come from resolveRailCategories (canonical CATEGORY_META); the rail
 * renders exactly what it is given — it never invents slugs or labels.
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
