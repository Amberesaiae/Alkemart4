import type { ReactNode } from "react"
import { cn } from "@workspace/ui"

type GlassCardProps = {
  children: ReactNode
  className?: string
  as?: "div" | "section" | "article"
}

function GlassCard({ children, className, as: Tag = "div" }: GlassCardProps) {
  return (
    <Tag className={cn("glass-card", className)}>
      {children}
    </Tag>
  )
}
export { GlassCard }
