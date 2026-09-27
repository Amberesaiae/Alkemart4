import { cn } from "cn"

/**
 * Page title row. One h1 per page; `actions` holds the page's primary action
 * (at most one `brand` button) and secondary ones.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow ? <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="max-w-2xl text-[15px] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Section title inside a page (h2). */
export function SectionTitle({
  id,
  title,
  action,
  className,
}: {
  id?: string
  title: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 id={id} className="text-base font-bold sm:text-lg">
        {title}
      </h2>
      {action}
    </div>
  )
}
