import type { ReactNode } from "react"
import { cn } from "@workspace/ui"

type BottomBarProps = {
  children: ReactNode
  className?: string
}

function BottomBar({ children, className }: BottomBarProps) {
  return (
    <div className={cn("fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur-md p-3 shadow-xl md:hidden", className)}>
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {children}
      </div>
    </div>
  )
}
export { BottomBar }
