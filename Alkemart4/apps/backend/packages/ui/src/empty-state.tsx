import type { ReactNode } from "react"
import { cn } from "./cn"

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border border-dashed border-border bg-card px-6 py-12 text-center sm:py-14",
        className,
      )}
      role="status"
    >
      {icon ? <div className="mb-5 flex justify-center">{icon}</div> : null}
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
