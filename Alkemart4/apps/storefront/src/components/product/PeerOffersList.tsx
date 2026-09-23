import { Price } from "@/components/price"
import type { PeerOffer } from "@/lib/products"
import { cn } from "@/lib/utils"

type Props = {
  offers: PeerOffer[]
  activeOfferId: string | null
  onSelect: (offerId: string) => void
  className?: string
  title?: string
  /** Buyer-visible ranking reason from the API (Phase 3C). Null hides it. */
  explanation?: string | null
}

function conditionLabel(condition: string): string {
  const c = condition.trim().toLowerCase()
  if (c === "new") return "New"
  if (c === "locally_used") return "Locally used"
  if (c === "refurbished") return "Refurbished"
  return condition.trim()
}

/**
 * Mowafer “Other Prices / Retailers” — multi-seller offer comparison.
 * Presentational; parent owns selection + ATC.
 *
 * Honesty rules: a single offer drops comparison language; was-prices and
 * save badges render only when the reference price carries provenance
 * (`discountPercent` non-null); unknown terms render as nothing.
 */
export function PeerOffersList({
  offers,
  activeOfferId,
  onSelect,
  className,
  title,
  explanation,
}: Props) {
  if (!offers.length) return null
  const single = offers.length === 1
  const heading = title ?? (single ? "Seller offer" : "Other sellers offering this item")

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">{heading}</h2>
        {single ? null : (
          <span className="text-xs font-medium text-muted-foreground">
            {offers.length} offers
          </span>
        )}
      </div>
      {explanation && !single ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{explanation}</p>
      ) : null}
      <ul className="divide-y divide-border/60">
        {offers.map((o) => {
          const selected = o.offerId === activeOfferId
          const terms: string[] = []
          if (o.condition) terms.push(conditionLabel(o.condition))
          if (o.deliveryPromise) terms.push(o.deliveryPromise)
          if (o.totalAmount != null && o.deliveryAmount != null) {
            terms.push(`Total incl. delivery`)
          }
          return (
            <li key={o.offerId} className="py-1">
              <button
                type="button"
                onClick={() => onSelect(o.offerId)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left text-sm transition-all",
                  selected
                    ? "bg-muted font-semibold ring-1 ring-primary/40 shadow-xs text-foreground"
                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border transition-all",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background",
                    )}
                  >
                    {selected ? (
                      <span className="size-1.5 rounded-full bg-current" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{o.seller.name}</p>
                    {terms.length > 0 ? (
                      <p className="truncate text-xs font-medium text-muted-foreground">
                        {terms.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="flex items-center gap-2">
                    {o.compareAtAmount != null && o.discountPercent != null ? (
                      <span className="text-xs text-muted-foreground">
                        <span className="line-through">
                          <Price
                            amount={o.compareAtAmount}
                            currencyCode={o.currencyCode}
                            size="sm"
                          />
                        </span>{" "}
                        <span className="font-bold text-tone-scarce-ink">
                          −{o.discountPercent}%
                        </span>
                      </span>
                    ) : null}
                    <Price
                      amount={o.amount}
                      currencyCode={o.currencyCode}
                      size="sm"
                      className="font-bold text-tone-brand-ink"
                    />
                  </div>
                  {o.totalAmount != null && o.deliveryAmount != null ? (
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      <Price
                        amount={o.totalAmount}
                        currencyCode={o.currencyCode}
                        size="sm"
                      />{" "}
                      total
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
