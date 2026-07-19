import { cn } from "@/lib/utils"

/**
 * Canonical product grid — always 4 columns from sm up.
 * Mobile: 2 (readable thumbs). Never 3 or 5.
 */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"

export function ProductGridShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(PRODUCT_GRID_CLASS, className)}>{children}</div>
}
