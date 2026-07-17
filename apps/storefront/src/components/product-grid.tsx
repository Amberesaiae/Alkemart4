import { cn } from "@/lib/utils"

/** Shared catalog grid — card and skeleton must use the same columns. */
export const PRODUCT_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"

export function ProductGridShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(PRODUCT_GRID_CLASS, className)}>{children}</div>
}
