import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, CheckmarkCircle02Icon, DeliveryTruck01Icon, Location01Icon } from "@hugeicons/core-free-icons"
import { Price } from "@/components/commerce/price"
import { Rating } from "@/components/commerce/rating"
import { SectionHeader } from "@/components/commerce/section-header"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { useVendorDirectory } from "@/hooks/use-vendors"
import { getPeerComparison, productParam, type StoreProductCard } from "@/lib/products"
import { formatMoney, useMarket } from "@/lib/market"
import { thumbFallback } from "@alkemart/shared/media"

/**
 * "One product. More choices." — the marketplace's reason to exist, shown
 * with a real multi-seller product and its real offers. Hidden when no
 * product currently has more than one seller.
 */
export function CompareShowcase({ products }: { products: StoreProductCard[] }) {
  const market = useMarket()
  const vendors = useVendorDirectory()
  const pick = [...products]
    .filter((p) => (p.offerCount ?? 0) > 1 && p.identity?.comparisonEligible !== false)
    .sort((a, b) => (b.offerCount ?? 0) - (a.offerCount ?? 0))[0]
  const peersQ = useQuery({
    queryKey: ["store", "peer-offers", pick?.id, "total"],
    queryFn: () => getPeerComparison(pick!.id, { sort: "total" }),
    enabled: Boolean(pick),
  })
  const offers = (peersQ.data?.offers ?? []).slice(0, 3)
  const totalOf = (o: (typeof offers)[number]) => o.totalAmount ?? (o.amount == null ? null : o.amount + (o.deliveryAmount ?? 0))
  const totals = offers.map(totalOf).filter((t): t is number => t != null)
  const bestId = totals.length ? offers.find((o) => totalOf(o) === Math.min(...totals))?.offerId : undefined
  if (!pick || (peersQ.isSuccess && offers.length < 2)) return null
  const image = pick.thumbUrl ?? pick.thumbnail
  const to = { to: "/product/$id" as const, params: { id: productParam(pick) } }

  return (
    <section className="container-page" aria-labelledby="compare-title">
      <SectionHeader id="compare-title" title="One product. More choices." subtitle="The same item from different shops — compare, then choose." />
      <div className="grid overflow-hidden rounded-3xl border border-border lg:grid-cols-[0.95fr_1.4fr]">
        <Link {...to} className="flex gap-5 bg-surface p-5 sm:p-6">
          <span className="size-28 shrink-0 overflow-hidden rounded-2xl bg-background sm:size-36">
            {image ? <img src={image} alt="" className="size-full object-contain p-3 mix-blend-multiply" onError={thumbFallback(pick.thumbnail)} /> : null}
          </span>
          <span className="min-w-0 space-y-2">
            <span className="line-clamp-2 text-lg font-bold">{pick.title}</span>
            {pick.categoryLabel ? <span className="block text-sm text-muted-foreground">{pick.categoryLabel}</span> : null}
            <span className="block">
              <span className="block text-xs text-muted-foreground">From</span>
              <Price amount={pick.amount} currency={pick.currencyCode} size="xl" />
            </span>
            <span className="block space-y-1 pt-1 text-sm">
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-success" /> Compare {pick.offerCount} sellers
              </span>
              <span className="flex items-center gap-2">
                <HugeiconsIcon icon={DeliveryTruck01Icon} className="size-4 text-success" /> Delivery shown per seller
              </span>
              {market.paymentMethods.includes("cod") ? (
                <span className="flex items-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-success" /> Pay on delivery
                </span>
              ) : null}
            </span>
          </span>
        </Link>

        <div className="divide-y divide-border">
          {offers.map((o) => {
            const v = o.seller.handle ? vendors.get(o.seller.handle) : undefined
            const total = totalOf(o)
            return (
              <Link
                key={o.offerId}
                {...to}
                search={{ offer: o.offerId }}
                className="group flex items-center gap-3 px-5 py-4 hover:bg-muted/50 sm:gap-4 sm:px-6"
                aria-label={`Choose ${o.seller.name ?? "this seller"}${total != null ? `, ${formatMoney(total, o.currencyCode)} total` : ""}`}
              >
                <SellerAvatar name={o.seller.name ?? "Seller"} logo={v?.logo} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate font-semibold">{o.seller.name}</span>
                    {o.offerId === bestId ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[length:var(--text-legacy-11)] font-bold text-brand-foreground">Best price</span>
                    ) : null}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <Rating avg={v?.ratingAvg} count={v?.ratingCount} />
                    {v?.location ? (
                      <span className="inline-flex items-center gap-0.5">
                        <HugeiconsIcon icon={Location01Icon} className="size-3.5" aria-hidden />
                        {v.location}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold tabular">{total != null ? formatMoney(total, o.currencyCode) : "—"}</p>
                  <p className="text-[length:var(--text-legacy-11)] text-muted-foreground tabular">
                    {o.deliveryAmount == null ? "+ delivery" : o.deliveryAmount === 0 ? "free delivery" : `incl. ${formatMoney(o.deliveryAmount, o.currencyCode)} delivery`}
                  </p>
                </div>
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            )
          })}
          <div className="flex justify-end px-5 py-3 sm:px-6">
            <Link {...to} hash="sellers" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold hover:underline">
              See all {pick.offerCount} sellers <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
