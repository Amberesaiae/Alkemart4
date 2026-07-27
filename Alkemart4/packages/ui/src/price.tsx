import { cn } from "./cn"

type PriceProps = {
  amount: number | null | undefined
  currency?: string
  className?: string
  size?: "sm" | "md" | "lg"
  unavailableLabel?: string
}

const sizeClass = {
  sm: "text-sm font-semibold",
  md: "text-base font-semibold",
  lg: "text-xl font-bold tracking-tight",
} as const

function formatMoney(amount: number, currency?: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "GHS",
      currencyDisplay: "narrowSymbol",
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency ?? "GHS"}`
  }
}

function Price({
  amount,
  currency,
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
    <span className={cn(sizeClass[size], "text-foreground tabular-nums", className)}>
      {formatMoney(amount, currency)}
    </span>
  )
}

export { Price }
