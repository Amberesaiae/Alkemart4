import { Link, type LinkProps } from "@tanstack/react-router"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Alert02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { BrandIllustration, type BrandIllustrationName } from "@workspace/console-ui/components/brand-illustration"

/**
 * Empty result. Artwork is bundled by the shared kit; icons remain a fallback.
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
  illustration?: BrandIllustrationName
  action?: { label: string } & Pick<LinkProps, "to" | "params" | "search">
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Empty className={cn("rounded-3xl border border-dashed border-border bg-card py-12", className)}>
      <EmptyHeader>
        {illustration ? (
          <BrandIllustration name={illustration} fallback={<EmptyMedia variant="icon"><HugeiconsIcon icon={icon} /></EmptyMedia>} />
        ) : null}
        {!illustration ? <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} />
        </EmptyMedia> : null}
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
  const offline = (typeof navigator !== "undefined" && !navigator.onLine) || (error instanceof TypeError && /fetch|network/i.test(error.message))
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-10 text-center",
        className,
      )}
    >
      <BrandIllustration name={offline ? "offline" : "not-found"} fallback={<span className="grid size-11 place-items-center rounded-full bg-muted">
        <HugeiconsIcon icon={Alert02Icon} className="size-5" />
      </span>} />
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
