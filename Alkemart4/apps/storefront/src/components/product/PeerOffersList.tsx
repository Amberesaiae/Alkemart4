import { Price } from "@/components/price"
import type { PeerOffer } from "@/lib/products"
import { cn } from "@/lib/utils"

type Props = {
  offers: PeerOffer[]
  activeOfferId: string | null
  onSelect: (offerId: string) => void
  className?: string
  title?: string
}

/**
 * Mowafer “Other Prices / Retailers” — multi-seller offer comparison.
 * Presentational; parent owns selection + ATC.
 */
export function PeerOffersList({
  offers,
  activeOfferId,
  onSelect,
  className,
  title = "Other sellers offering this item",
}: Props) {
  if (!offers.length) return null

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <span className="text-xs font-medium text-muted-foreground">{offers.length} offers</span>
      </div>
      <ul className="divide-y divide-border/60">
        {offers.map((o) => {
          const selected = o.offerId === activeOfferId
          return (
            <li key={o.offerId} className="py-1">
              <button
                type="button"
                onClick={() => onSelect(o.offerId)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left text-sm transition-all",
                  selected
                    ? "bg-primary/15 font-semibold ring-1 ring-primary/40 shadow-xs text-foreground"
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
                  <span className="min-w-0 truncate font-medium text-foreground">{o.seller.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Price
                    amount={o.amount}
                    currencyCode={o.currencyCode}
                    size="sm"
                    className="font-bold text-foreground"
                  />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
