import { Link, type LinkProps } from "@tanstack/react-router"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Alert02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

/**
 * Empty result. `illustration` points at a Codex spot illustration under
 * /illustrations; the icon shows until (or if) the file is missing.
 */
export function EmptyState({
  title,
  description,
  icon = Search01Icon,
  illustration,
  action,
  className,
  children,
}: {
  title: string
  description?: React.ReactNode
  icon?: IconSvgElement
  illustration?: string
  action?: { label: string } & Pick<LinkProps, "to" | "params" | "search">
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Empty className={cn("rounded-3xl border border-dashed border-border bg-card py-12", className)}>
      <EmptyHeader>
        {illustration ? (
          <img
            src={`/illustrations/${illustration}.webp`}
            alt=""
            className="mx-auto mb-2 h-32 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = "none"
              e.currentTarget.nextElementSibling?.removeAttribute("hidden")
            }}
          />
        ) : null}
        <EmptyMedia variant="icon" hidden={Boolean(illustration)}>
          <HugeiconsIcon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action || children ? (
        <EmptyContent>
          {action ? (
            <Button asChild size="lg">
              <Link to={action.to} params={action.params as never} search={action.search as never}>
                {action.label}
              </Link>
            </Button>
          ) : null}
          {children}
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

/** A failed load — says so, offers a retry. Never dressed up as "no results". */
export function ErrorState({
  title = "Something went wrong",
  error,
  onRetry,
  className,
}: {
  title?: string
  error?: unknown
  onRetry?: () => void
  className?: string
}) {
  const message = error instanceof Error ? error.message : null
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-muted">
        <HugeiconsIcon icon={Alert02Icon} className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">
          {message ?? "Check your connection and try again."}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
