import { cn } from "@/lib/utils"
import { formatMoney } from "@/lib/cart"

type PriceProps = {
  amount: number | null | undefined
  currencyCode?: string | null
  className?: string
  size?: "sm" | "md" | "lg"
  /** When amount missing — honest empty, never invent a price */
  unavailableLabel?: string
}

const sizeClass = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  lg: "text-xl font-bold",
} as const

/** Consistent GHS/currency display from API amounts only.
 *  Prices render in deep brand bronze (tone-brand-ink) — distinct from the
 *  ink title and muted seller lines, AA-safe on white cards. */
export function Price({
  amount,
  currencyCode,
  className,
  size = "md",
  unavailableLabel = "Price unavailable",
}: PriceProps) {
  if (amount == null || !Number.isFinite(amount)) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        {unavailableLabel}
      </span>
    )
  }
  return (
    <span className={cn(sizeClass[size], "text-tone-brand-ink tabular-nums", className)}>
      {formatMoney(amount, currencyCode)}
    </span>
  )
}
