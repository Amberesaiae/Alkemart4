import type { ReactNode } from "react"
import { cn } from "@workspace/ui"

type BottomBarProps = {
  children: ReactNode
  className?: string
}

function BottomBar({ children, className }: BottomBarProps) {
  return (
    <div className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3 md:hidden", className)}>
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {children}
      </div>
    </div>
  )
}
export { BottomBar }
