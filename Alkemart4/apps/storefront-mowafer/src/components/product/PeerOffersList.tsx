import { Price } from "@workspace/ui"
import type { PeerOffer } from "@/lib/products"
import { cn } from "@/lib/utils"
import { normalizeCurrencyCode } from "@/lib/money"

type Props = {
  offers: PeerOffer[]
  activeOfferId: string | null
  onSelect: (offerId: string) => void
  className?: string
  title?: string
}

export function PeerOffersList({
  offers,
  activeOfferId,
  onSelect,
  className,
  title = "Other sellers offering this item",
}: Props) {
  if (!offers.length) return null

  return (
    <div className={cn("space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xs", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {offers.length} {offers.length === 1 ? "offer" : "offers"}
        </span>
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
                    ? "bg-muted font-semibold text-foreground shadow-xs ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="min-w-0 truncate font-medium text-foreground">{o.seller.name}</span>
                <Price
                  amount={o.amount}
                  currency={normalizeCurrencyCode(o.currencyCode)}
                  size="sm"
                  className="font-bold"
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
