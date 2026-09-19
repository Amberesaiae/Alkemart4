import { Link } from "@tanstack/react-router"
import {
  Baby,
  Basket,
  Coffee,
  DeviceMobile,
  FirstAid,
  House,
  PawPrint,
  SquaresFour,
  TShirt,
} from "@phosphor-icons/react"
import {
  capRailDepartments,
  type RailCategory,
  type RailIconId,
} from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

type Props = {
  categories: RailCategory[]
  activeSlug?: string
  className?: string
}

const ICONS: Record<RailIconId, typeof DeviceMobile> = {
  electronics: DeviceMobile,
  fashion: TShirt,
  home: House,
  health: FirstAid,
  baby: Baby,
  food: Basket,
  beverages: Coffee,
  pet: PawPrint,
  all: SquaresFour,
}

export function CategoryIconRail({ categories, activeSlug, className }: Props) {
  const capped = capRailDepartments(categories)
  if (!capped.length) return null

  return (
    <nav aria-label="Departments" className={cn("border-b border-border bg-card", className)}>
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-start gap-1 overflow-x-auto px-4 py-2.5 sm:justify-center sm:flex-wrap sm:overflow-visible sm:px-6 sm:py-3">
        {capped.map((c) => {
          const slug = (c.handle || c.id).toLowerCase()
          const active = activeSlug === slug
          const Icon = ICONS[c.icon] ?? SquaresFour
          return (
            <Link
              key={c.id}
              to="/categories/$slug"
              params={{ slug }}
              data-testid={`rail-item-${slug}`}
              className={cn(
                "group relative flex shrink-0 flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5 transition",
                "hover:bg-muted/60",
                active ? "bg-muted/80 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={20} className="shrink-0" aria-hidden />
              <span
                className={cn(
                  "max-w-[9.5rem] truncate whitespace-nowrap text-sm font-medium leading-none sm:max-w-none",
                  active && "font-semibold",
                )}
              >
                {c.name}
              </span>
              <span
                className={cn(
                  "absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full",
                  active ? "bg-primary" : "bg-transparent",
                )}
                aria-hidden
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
