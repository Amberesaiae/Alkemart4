import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  actionLabel?: string
  /** File route path when action is internal */
  actionTo?: string
  actionParams?: Record<string, string>
  actionHref?: string
  className?: string
}

/**
 * Mowafer section title row: title left, optional “View more” right.
 */
export function SectionHeader({
  title,
  actionLabel,
  actionTo,
  actionParams,
  actionHref,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-3",
        className,
      )}
    >
      <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
        {title}
      </h2>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo as "/"}
          params={actionParams as never}
          className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && actionHref ? (
        <a
          href={actionHref}
          className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
        >
          {actionLabel}
        </a>
      ) : null}
    </div>
  )
}
