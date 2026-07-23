import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

export type Crumb = {
  label: string
  /** Internal path when clickable; omit for current page */
  to?: string
  params?: Record<string, string>
}

type Props = {
  items: Crumb[]
  className?: string
}

/**
 * Mowafer breadcrumb: Home / Section / Current
 * Current crumb is non-link, medium weight foreground.
 */
export function Breadcrumbs({ items, className }: Props) {
  if (!items.length) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-sm text-muted-foreground", className)}
    >
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? (
                <span className="select-none text-muted-foreground/70" aria-hidden>
                  /
                </span>
              ) : null}
              {last || !item.to ? (
                <span
                  className={cn(
                    "font-medium",
                    last ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to as "/"}
                  params={item.params as never}
                  className="transition hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
