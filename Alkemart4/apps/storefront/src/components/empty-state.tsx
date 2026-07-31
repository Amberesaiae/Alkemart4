import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui"
import { Illustration } from "@/components/illustration"
import type { IllustrationKey } from "@/lib/illustrations"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  title: string
  description?: string
  actionLabel?: string
  actionTo?: string
  actionSearch?: Record<string, string | undefined>
  className?: string
  /** Optional story illustration (curated catalog) */
  illustration?: IllustrationKey
  /** Optional path params for file routes like /categories/$slug */
  actionParams?: Record<string, string>
  /** Optional click handler (used instead of Link when actionTo is omitted) */
  actionOnClick?: () => void
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  actionSearch,
  actionParams,
  actionOnClick,
  className,
  illustration: art,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border border-dashed border-border bg-card px-6 py-12 text-center sm:py-14",
        className,
      )}
    >
      {art ? (
        <div className="mb-5 flex justify-center">
          <Illustration name={art} size="md" className="rounded-2xl" />
        </div>
      ) : null}
      <p className="text-lg font-bold tracking-tight text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {actionLabel && actionTo ? (
        <Button asChild className="mt-5 min-h-11" size="sm">
          <Link
            to={actionTo as "/"}
            params={actionParams as never}
            search={actionSearch as never}
          >
            {actionLabel}
          </Link>
        </Button>
      ) : actionLabel && actionOnClick ? (
        <Button onClick={actionOnClick} className="mt-5 min-h-11" size="sm">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
