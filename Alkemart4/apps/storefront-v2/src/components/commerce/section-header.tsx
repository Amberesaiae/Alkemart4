import { Link, type LinkProps } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

export function SectionHeader({
  title,
  eyebrow,
  subtitle,
  action,
  className,
  children,
  id,
}: {
  title: string
  eyebrow?: string
  subtitle?: string | null
  action?: { label: string } & Pick<LinkProps, "to" | "params" | "search">
  className?: string
  /** Right-side controls (e.g. rail arrows). */
  children?: React.ReactNode
  id?: string
}) {
  return (
    <div className={cn("section-header mb-3 flex flex-wrap items-end justify-between gap-4 sm:mb-5", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 id={id} className="text-lg font-extrabold sm:text-2xl">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action ? (
          <Link
            to={action.to}
            params={action.params as never}
            search={action.search as never}
            className="-my-2 inline-flex min-h-10 items-center gap-1 rounded-full py-2 text-sm font-semibold hover:underline"
          >
            {action.label}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  )
}
