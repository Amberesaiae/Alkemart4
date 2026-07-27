import type { ReactNode } from "react"
import { cn } from "@workspace/ui"

type OrderSummaryProps = {
  children?: ReactNode
  className?: string
}

function OrderSummary({ children, className }: OrderSummaryProps) {
  return (
    <aside className={cn("h-max space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-24", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Order summary
      </p>
      {children}
    </aside>
  )
}
export { OrderSummary }
