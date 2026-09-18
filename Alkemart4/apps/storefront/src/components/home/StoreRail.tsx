import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import type { HomeSection } from "@alkemart/shared/homepage"
import {
  MerchEmpty,
  MerchShelf,
  StoreCardArt,
  StoreCardBadges,
  StoreCardFacts,
  storeCardShell,
} from "@workspace/ui"
import { Storefront } from "@phosphor-icons/react"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { matchesArea, useDeliverTo } from "@/lib/deliver-to"
import { cn } from "@/lib/utils"

/**
 * A shelf of shops rather than products.
 *
 * A multi-vendor marketplace has to be able to merchandise its vendors —
 * "Top rated near you", "Fastest delivery", "New this month" — and no product
 * shelf can express that. Ordering comes from the same computed facts the
 * store cards show, so what the rail claims and what the card shows agree.
 */
export function StoreRail({ section }: { section: Extract<HomeSection, { type: "store_rail" }> }) {
  const [area] = useDeliverTo()

  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    staleTime: 300_000,
  })

  const shops = useMemo(() => {
    const all = (vendorsQ.data ?? []).filter((v) => v.availability !== "paused")
    switch (section.source) {
      case "manual": {
        const bySlug = new Map(all.map((v) => [v.slug, v]))
        return (section.sellerHandles ?? [])
          .map((h) => bySlug.get(h))
          .filter((v): v is StoreVendor => Boolean(v))
      }
      case "top_rated":
        // Unrated shops sort last rather than as zero — unknown, not bad.
        return [...all].sort((a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1))
      case "fastest":
        return [...all].sort(
          (a, b) =>
            (a.deliveryMinutes ?? Number.POSITIVE_INFINITY) -
            (b.deliveryMinutes ?? Number.POSITIVE_INFINITY),
        )
      case "near_me":
        return all.filter((v) => matchesArea(v.location, area))
      default:
        return all
    }
  }, [vendorsQ.data, section.source, section.sellerHandles, area])

  const shown = shops.slice(0, section.limit)

  if (vendorsQ.isLoading) {
    return (
      <section className="space-y-4">
        <h2 className="type-section">{section.title}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: Math.min(section.limit, 4) }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-black/5" />
          ))}
        </div>
      </section>
    )
  }

  if (!shown.length) {
    return (
      <MerchEmpty
        title={section.title}
        body={
          section.source === "near_me" && !area
            ? "Choose where you want delivery to see shops near you."
            : section.source === "near_me"
              ? `No shops in ${area} yet.`
              : "No open shops match this rail yet."
        }
      />
    )
  }

  const cards = shown.map((shop) => <StoreRailCard key={shop.slug} shop={shop} />)

  if (section.layout === "carousel") {
    return (
      <MerchShelf title={section.title} subtitle={section.subtitle} layout="carousel">
        {shown.map((shop) => (
          <div key={shop.slug} className="w-52 shrink-0 snap-start sm:w-60">
            <StoreRailCard shop={shop} />
          </div>
        ))}
      </MerchShelf>
    )
  }

  return (
    <MerchShelf title={section.title} subtitle={section.subtitle}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{cards}</div>
    </MerchShelf>
  )
}

function StoreRailCard({ shop }: { shop: StoreVendor }) {
  return (
    <Link
      to="/shops/$slug"
      params={{ slug: shop.slug }}
      aria-label={`Visit ${shop.name}`}
      className={cn(
        storeCardShell,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <StoreCardArt
        src={shop.banner ?? shop.logo}
        className="aspect-[4/3]"
        fallback={<Storefront size={32} aria-hidden />}
      />
      <div className="flex flex-col gap-1 p-3">
        <span className="truncate text-sm font-bold tracking-tight">{shop.name}</span>
        {shop.location ? (
          <span className="truncate text-xs text-muted-foreground">{shop.location}</span>
        ) : null}
        <StoreCardFacts store={shop} />
        <StoreCardBadges badges={shop.badges} max={1} className="pt-0.5" />
      </div>
    </Link>
  )
}
