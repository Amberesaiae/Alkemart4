import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

type Props = {
  children: ReactNode
  className?: string
  as?: "div" | "section" | "main" | "header" | "footer" | "nav"
}

/**
 * Content column for sections that need the same max width as main/header.
 * Full-bleed shell lives in __root; this only constrains inner content.
 */
export function Container({ children, className, as: Tag = "div" }: Props) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6", className)}>
      {children}
    </Tag>
  )
}
