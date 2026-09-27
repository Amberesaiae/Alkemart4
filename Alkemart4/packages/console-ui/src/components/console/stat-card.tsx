import { cn } from "cn"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Skeleton } from "@workspace/console-ui/components/skeleton"

/**
 * A headline number. `hint` is the honest context line ("last 30 days",
 * "from 12 orders") — never an invented trend.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  loading,
  href,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: IconSvgElement
  loading?: boolean
  /** Makes the whole card a link (e.g. to the queue it counts). */
  href?: string
  className?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon ? (
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground">
            <HugeiconsIcon icon={icon} className="size-[18px]" />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-28" />
      ) : (
        <p className="mt-1 text-2xl font-extrabold tracking-tight tabular sm:text-[1.75rem]">{value}</p>
      )}
      {hint ? <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p> : null}
    </>
  )
  const cls = cn("block rounded-2xl border bg-card p-4 sm:p-5", href && "transition-colors hover:border-foreground/25", className)
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  )
}
