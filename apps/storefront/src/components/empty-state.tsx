import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
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
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo,
  actionSearch,
  className,
  illustration: art,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center shadow-sm sm:py-14",
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
        <Button asChild className="mt-5 min-h-11 rounded-xl" size="sm">
          <Link to={actionTo as "/"} search={actionSearch as never}>
            {actionLabel}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
