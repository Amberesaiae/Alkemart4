import type { ReactNode } from "react"
import { cn } from "./cn"

type ContainerProps = {
  children: ReactNode
  className?: string
  as?: "div" | "section" | "main" | "header" | "footer" | "nav"
}

function Container({ children, className, as: Tag = "div" }: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6", className)}>
      {children}
    </Tag>
  )
}

export { Container }
