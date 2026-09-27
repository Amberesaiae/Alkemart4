import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Clock01Icon, Location01Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Rating } from "@/components/commerce/rating"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { formatMoney } from "@/lib/market"
import { formatDistance } from "@/lib/nearby"
import { shopDeliveryText, type StoreVendor } from "@/lib/vendors"
import { cn } from "@/lib/utils"

const BADGE_TONE: Record<string, string> = {
  earned: "bg-brand text-brand-foreground",
  good: "bg-success-soft text-success",
  warn: "bg-muted text-warning",
  neutral: "bg-muted text-muted-foreground",
}

/**
 * Shop card: the shop's own banner and logo, computed badges only
 * (top rated, fast delivery…), and up to three of its real products.
 */
export function StoreCard({
  shop,
  distanceKm,
  className,
}: {
  shop: StoreVendor
  distanceKm?: number | null
  className?: string
}) {
  const featured = (shop.featured ?? []).slice(0, 3)
  const distance = formatDistance(distanceKm ?? null)
  return (
    <Link
      to="/shops/$slug"
      params={{ slug: shop.slug }}
      className={cn(
        "group/store flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-shadow hover:shadow-lift",
        className,
      )}
    >
      <div className={cn("relative bg-muted", shop.banner ? "h-28 sm:h-32" : "h-16 sm:h-20")}>
        {shop.banner ? (
          <img
            src={shop.banner}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover/store:scale-[1.03]"
          />
        ) : (
          <div
            aria-hidden
            className="size-full bg-[radial-gradient(circle_at_20%_20%,var(--brand)_0,transparent_45%),radial-gradient(circle_at_80%_60%,var(--dept-fashion)_0,transparent_50%)] opacity-40"
          />
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {(shop.badges ?? []).slice(0, 2).map((b) => (
            <Badge key={b.id} className={BADGE_TONE[b.tone] ?? BADGE_TONE.neutral}>
              {b.label}
            </Badge>
          ))}
        </div>
        <SellerAvatar
          name={shop.name}
          logo={shop.logo}
          size="lg"
          className="absolute -bottom-7 left-4 ring-4 ring-card"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-9 pb-4">
        <div className="min-w-0">
          <h3 className="truncate font-bold">{shop.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <Rating avg={shop.ratingAvg} count={shop.ratingCount} />
            {shop.location ? (
              <span className="inline-flex items-center gap-1">
                <HugeiconsIcon icon={Location01Icon} className="size-3.5" />
                {shop.location}
              </span>
            ) : null}
            {distance ? <span>{distance}</span> : null}
          </div>
          {shopDeliveryText(shop) ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground">
              <HugeiconsIcon icon={Clock01Icon} className="size-3.5" aria-hidden />
              {shopDeliveryText(shop)}
            </p>
          ) : null}
          {shop.tagline ? (
            <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">{shop.tagline}</p>
          ) : null}
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {featured.map((f) => (
              <div key={f.productId} className="overflow-hidden rounded-xl bg-surface">
                {f.imageUrl ? (
                  <img
                    src={f.imageUrl}
                    alt={f.title}
                    loading="lazy"
                    className="aspect-square w-full object-contain p-1.5 mix-blend-multiply"
                  />
                ) : (
                  <div className="aspect-square" />
                )}
                <p className="truncate px-1.5 pb-1.5 text-xs font-semibold tabular">
                  {formatMoney(Number(f.fromPricePesewas) / 100, null, { compact: true })}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        <span className="mt-auto inline-flex items-center gap-1 self-start pt-1 text-sm font-semibold">
          Visit store
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-4 transition-transform group-hover/store:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  )
}

export function StoreCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border" aria-hidden>
      <Skeleton className="h-28 rounded-none" />
      <div className="space-y-2 p-4 pt-9">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

