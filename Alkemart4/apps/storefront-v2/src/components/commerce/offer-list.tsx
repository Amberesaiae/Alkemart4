import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, DeliveryTruck01Icon, Location01Icon } from "@hugeicons/core-free-icons"
import { Rating } from "@/components/commerce/rating"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { useVendorDirectory } from "@/hooks/use-vendors"
import { formatMoney } from "@/lib/market"
import type { PeerOffer } from "@/lib/products"
import { COMPARE_ENABLED } from "@/lib/features"
import { cn } from "@/lib/utils"

/** What the buyer actually pays: item + delivery (delivery unknown counts as 0 but is shown as "at checkout"). */
const totalOf = (o: PeerOffer) => o.totalAmount ?? (o.amount == null ? null : o.amount + (o.deliveryAmount ?? 0))

/**
 * "Available from N sellers" as a decision aid. Each seller is one
 * selectable card (a radio group — tap anywhere), led by the total you pay,
 * then what makes the difference: delivery, rating, where they are, and
 * their terms. Badges are computed and stated plainly; the lowest total is
 * preselected by the page and labelled — never a hidden favourite.
 */
export function OfferList({
  offers,
  activeOfferId,
  onChoose,
  explanation,
  compact,
}: {
  offers: PeerOffer[]
  activeOfferId: string | null
  onChoose: (offerId: string) => void
  explanation?: string | null
  compact?: boolean
}) {
  const vendors = useVendorDirectory()
  const totals = offers.map(totalOf).filter((t): t is number => t != null)
  const bestTotal = totals.length ? Math.min(...totals) : null
  const bestId = offers.find((o) => totalOf(o) === bestTotal)?.offerId ?? null
  const topRated = offers
    .map((o) => ({ o, v: o.seller.handle ? vendors.get(o.seller.handle) : undefined }))
    .filter(({ v }) => (v?.ratingCount ?? 0) >= 3)
    .sort((a, b) => (b.v?.ratingAvg ?? 0) - (a.v?.ratingAvg ?? 0))[0]?.o.offerId

  const move = (from: number, by: number) => {
    const next = offers[(from + by + offers.length) % offers.length]
    if (next) {
      onChoose(next.offerId)
      document.getElementById(`offer-${next.offerId}`)?.focus()
    }
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Choose a seller" className="space-y-2.5">
        {offers.map((o, i) => {
          const v = o.seller.handle ? vendors.get(o.seller.handle) : undefined
          const active = o.offerId === activeOfferId
          const name = o.seller.name ?? "Seller"
          const total = totalOf(o)
          const diff = total != null && bestTotal != null ? total - bestTotal : null
          const terms = [o.condition && o.condition !== "new" ? o.condition.replace(/_/g, " ") : null, o.returnsRef, o.warrantyRef].filter(Boolean) as string[]
          return (
            <div key={o.offerId} className="space-y-1">
            <div
              id={`offer-${o.offerId}`}
              role="radio"
              aria-checked={active}
              tabIndex={active || (!activeOfferId && i === 0) ? 0 : -1}
              onClick={() => onChoose(o.offerId)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault()
                  onChoose(o.offerId)
                } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                  e.preventDefault()
                  move(i, 1)
                } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                  e.preventDefault()
                  move(i, -1)
                }
              }}
              className={cn(
                "group cursor-pointer rounded-2xl border-2 bg-card p-3.5 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-4",
                active ? "border-foreground" : "border-border hover:border-foreground/30",
              )}
            >
              <div className="flex items-start gap-3">
                <SellerAvatar name={name} logo={v?.logo} size={compact ? "sm" : "md"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold">{name}</span>
                    {COMPARE_ENABLED && o.offerId === bestId && offers.length > 1 ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-foreground">Best price</span>
                    ) : null}
                    {o.offerId === topRated && offers.length > 1 ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Top rated</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Rating avg={v?.ratingAvg} count={v?.ratingCount} />
                    {v?.location ? (
                      <span className="inline-flex items-center gap-1">
                        <HugeiconsIcon icon={Location01Icon} className="size-3.5" aria-hidden />
                        {v.location}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border-2",
                    active ? "border-foreground bg-foreground text-background" : "border-border",
                  )}
                >
                  {active ? <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" /> : null}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t border-border pt-3">
                <div>
                  <p className="text-lg leading-tight font-extrabold tabular">
                    {total != null ? formatMoney(total, o.currencyCode) : "—"}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">{o.deliveryAmount == null ? "+ delivery" : "total"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular">
                    {formatMoney(o.amount, o.currencyCode)} item
                    {o.deliveryAmount == null ? " · delivery at checkout" : o.deliveryAmount === 0 ? " · free delivery" : ` + ${formatMoney(o.deliveryAmount, o.currencyCode)} delivery`}
                  </p>
                </div>
                {COMPARE_ENABLED && diff != null && diff > 0 ? (
                  <p className="text-xs font-semibold text-muted-foreground tabular">{formatMoney(diff, o.currencyCode)} more than the best price</p>
                ) : null}
              </div>

              {!compact && (o.deliveryPromise || terms.length) ? (
                <ul className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
                  {o.deliveryPromise ? (
                    <li className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 font-medium">
                      <HugeiconsIcon icon={DeliveryTruck01Icon} className="size-3.5" aria-hidden />
                      {o.deliveryPromise}
                    </li>
                  ) : null}
                  {terms.map((t) => (
                    <li key={t} className="rounded-full bg-surface px-2.5 py-1 capitalize">
                      {t}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {/* Outside the radio: a link inside an option can't be reached by screen readers. */}
            {o.seller.handle ? (
              <Link
                to="/shops/$slug"
                params={{ slug: o.seller.handle }}
                className="-mt-1 ml-4 inline-flex min-h-8 items-center text-xs font-semibold underline-offset-4 hover:underline"
              >
                See {name}'s shop
              </Link>
            ) : null}
            </div>
          )
        })}
      </div>
      {COMPARE_ENABLED && explanation ? <p className="text-xs text-muted-foreground">{explanation}</p> : null}
    </div>
  )
}
