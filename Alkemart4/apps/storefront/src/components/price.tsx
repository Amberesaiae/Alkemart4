import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/cart"

type PriceProps = {
  amount: number | null | undefined
  currencyCode?: string | null
  className?: string
  size?: "sm" | "md" | "lg"
  /** When amount missing — honest empty, never invent a price */
  unavailableLabel?: string
  /** Renders "From" before the amount — multi-seller products have no single price. */
  from?: boolean
}

const sizeClass = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  lg: "text-xl font-bold tracking-tight",
} as const

/** Consistent GHS/currency display from API amounts only. */
export function Price({
  amount,
  currencyCode,
  className,
  size = "md",
  unavailableLabel = "Price unavailable",
  from = false,
}: PriceProps) {
  if (amount == null || !Number.isFinite(amount)) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        {unavailableLabel}
      </span>
    )
  }
  return (
    <span className={cn(sizeClass[size], "text-foreground tabular-nums", className)}>
      {from ? <span className="mr-1 font-medium text-muted-foreground">From</span> : null}
      {formatMoney(amount, currencyCode)}
    </span>
  )
}
