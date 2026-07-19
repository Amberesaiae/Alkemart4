import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"

type Props = {
  /** Button label — Mowafer uses “View More” */
  label?: string
  /** When more server rows exist, call this (PLP load-more). If omitted, renders a Link. */
  onClick?: () => void
  loading?: boolean
  /** Link target when not using onClick */
  to?: string
  params?: Record<string, string>
  className?: string
  /** Hide when false (e.g. no more pages) */
  show?: boolean
}

/**
 * Mowafer pagination control: centered soft pill.
 * Not a progress bar. Not “Load more” chrome.
 */
export function ViewMore({
  label = "View More",
  onClick,
  loading,
  to,
  params,
  className,
  show = true,
}: Props) {
  if (!show) return null

  const pill = cn(
    "inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-10 py-2.5 text-sm font-bold text-foreground transition",
    "hover:border-primary hover:bg-primary/15",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )

  return (
    <div className="flex justify-center pt-4">
      {onClick ? (
        <button
          type="button"
          className={pill}
          disabled={loading}
          onClick={onClick}
        >
          {loading ? "Loading…" : label}
        </button>
      ) : to ? (
        <Link to={to as "/"} params={params as never} className={pill}>
          {label}
        </Link>
      ) : null}
    </div>
  )
}
