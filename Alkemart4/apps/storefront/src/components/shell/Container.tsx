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
    // 1200px keeps prose readable, but a listing grid beside a 240px rail was
    // left with ~940px on a 1900px screen — two columns of products and a
    // third of the viewport empty. Widen on xl only; narrower screens are
    // unchanged.
    <Tag className={cn("mx-auto w-full max-w-[1200px] xl:max-w-[1440px] px-4 sm:px-6", className)}>
      {children}
    </Tag>
  )
}
