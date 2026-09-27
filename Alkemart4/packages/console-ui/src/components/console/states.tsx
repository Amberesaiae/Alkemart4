import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Alert02Icon, InboxIcon, WifiDisconnected02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/console-ui/components/empty"

type Err = { status?: number; message?: string } | null | undefined

function isOffline(error: Err) {
  return (typeof navigator !== "undefined" && !navigator.onLine) || (error != null && error.status == null)
}

/**
 * A failed load. Never rendered as "nothing here" — an outage must look like
 * an outage (CONSOLE-REDESIGN §6).
 */
export function ErrorState({
  title = "This didn't load",
  error,
  onRetry,
  className,
}: {
  title?: string
  error?: unknown
  onRetry?: () => void
  className?: string
}) {
  const err = error as Err
  const offline = isOffline(err)
  return (
    <Empty role="alert" className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={offline ? WifiDisconnected02Icon : Alert02Icon} />
        </EmptyMedia>
        <EmptyTitle>{offline ? "You're offline or the connection dropped" : title}</EmptyTitle>
        <EmptyDescription>
          {offline
            ? "Check your data or Wi-Fi, then try again. Nothing you saved is lost."
            : err?.message
              ? `The server said: ${err.message}`
              : "Please try again in a moment."}
        </EmptyDescription>
      </EmptyHeader>
      {onRetry ? (
        <EmptyContent>
          <Button size="lg" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

/** A real, successful "nothing here yet" — with the next step. */
export function EmptyState({
  title,
  description,
  icon = InboxIcon,
  action,
  className,
}: {
  title: string
  description?: React.ReactNode
  icon?: IconSvgElement
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={icon} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
