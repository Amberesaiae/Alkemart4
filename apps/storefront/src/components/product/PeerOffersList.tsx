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
  title = "Other sellers & prices",
}: Props) {
  if (!offers.length) return null

  return (
    <div
      className={cn(
        "space-y-2 rounded-2xl border border-border bg-muted/30 p-3",
        className,
      )}
    >
      <h2 className="text-sm font-bold">{title}</h2>
      <ul className="divide-y divide-border">
        {offers.map((o) => {
          const selected = o.offerId === activeOfferId
          return (
            <li key={o.offerId}>
              <button
                type="button"
                onClick={() => onSelect(o.offerId)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm transition",
                  selected
                    ? "bg-primary/20 font-semibold"
                    : "hover:bg-card",
                )}
              >
                <span className="min-w-0 truncate">{o.seller.name}</span>
                <Price
                  amount={o.amount}
                  currencyCode={o.currencyCode}
                  size="sm"
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
