import { formatMoney } from "@/lib/market"
import { cn } from "@/lib/utils"

/**
 * Money display. `from` prefixes "From" when several sellers quote — the
 * shown amount is the lowest, never presented as the only price.
 */
export function Price({
  amount,
  currency,
  from,
  compareAt,
  className,
  size = "md",
}: {
  amount: number | null | undefined
  currency?: string | null
  from?: boolean
  /** Previous price with provenance only (price history) — never invented. */
  compareAt?: number | null
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
}) {
  if (amount == null) {
    return <span className={cn("text-sm text-muted-foreground", className)}>Price on request</span>
  }
  const drop = compareAt != null && compareAt > amount
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 tabular", className)}>
      {from ? <span className="text-xs font-medium text-muted-foreground">From</span> : null}
      <span
        className={cn(
          "font-bold whitespace-nowrap text-foreground",
          size === "sm" && "text-sm",
          size === "md" && "text-[0.9375rem] sm:text-lg",
          size === "lg" && "text-xl",
          size === "xl" && "text-3xl font-extrabold tracking-tight",
        )}
      >
        {formatMoney(amount, currency, { compact: true })}
      </span>
      {drop ? (
        <>
          <s className="text-xs text-muted-foreground">{formatMoney(compareAt, currency)}</s>
          <span className="text-xs font-bold text-deal">
            −{Math.round(((compareAt - amount) / compareAt) * 100)}%
          </span>
        </>
      ) : null}
    </span>
  )
}
