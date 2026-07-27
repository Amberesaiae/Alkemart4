import { cn } from "./cn"

export type Crumb = {
  label: string
  href?: string
}

type BreadcrumbsProps = {
  items: Crumb[]
  className?: string
}

function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (!items.length) return null

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
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
              {last || !item.href ? (
                <span
                  className={cn("font-medium", last ? "text-foreground" : "text-muted-foreground")}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="transition hover:text-foreground hover:underline"
                >
                  {item.label}
                </a>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Breadcrumbs }
