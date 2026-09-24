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
  StoreCardFeaturedStrip,
  storeCardShell,
} from "@workspace/ui"
import { Bicycle, Star, ThumbsUp } from "@phosphor-icons/react"
import { StoreRailSkeleton } from "@/components/skeleton"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { matchesArea, useDeliverTo } from "@/lib/deliver-to"
import { cn } from "@/lib/utils"

/**
 * A shelf of shops matching Hubtel's landscape store cards.
 */
export function StoreRail({ section }: { section: Extract<HomeSection, { type: "store_rail" }> }) {
  const [area] = useDeliverTo()

  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    staleTime: 300_000,
  })

  const shops = useMemo(() => {
    // Real shops only — a thin market shows a thin rail, never demo filler.
    const raw = (vendorsQ.data ?? []).filter((v) => v.availability !== "paused")
    const all = raw
    switch (section.source) {
      case "manual": {
        const bySlug = new Map(all.map((v) => [v.slug, v]))
        return (section.sellerHandles ?? [])
          .map((h) => bySlug.get(h))
          .filter((v): v is StoreVendor => Boolean(v))
      }
      case "top_rated":
        // Unrated shops sort last, not as zero — unknown is not bad.
        return [...all].sort((a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1))
      case "fastest":
        return [...all].sort(
          (a, b) =>
            (a.deliveryMinutes ?? Number.POSITIVE_INFINITY) -
            (b.deliveryMinutes ?? Number.POSITIVE_INFINITY),
        )
      case "near_me": {
        const matched = all.filter((v) => matchesArea(v.location, area))
        return matched.length ? matched : all
      }
      default:
        return all
    }
  }, [vendorsQ.data, section.source, section.sellerHandles, area])

  const shown = shops.slice(0, section.limit)

  if (vendorsQ.isLoading && !shown.length) {
    return <StoreRailSkeleton count={3} />
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

  const action = section.showAllLink === false ? undefined : (
    <Link to="/shops" className="text-sm font-bold hover:underline">
      View more
    </Link>
  )

  const isLateNight =
    section.title.toLowerCase().includes("late") ||
    section.title.toLowerCase().includes("dawn")

  if (section.layout === "carousel") {
    return (
      <MerchShelf title={section.title} subtitle={section.subtitle} layout="carousel" action={action}>
        {isLateNight ? <LateNightPromoTile /> : null}
        {shown.map((shop) => (
          <div key={shop.slug} className="w-72 sm:w-80 md:w-[22rem] shrink-0 snap-start">
            <StoreRailCard shop={shop} />
          </div>
        ))}
      </MerchShelf>
    )
  }

  return (
    <MerchShelf title={section.title} subtitle={section.subtitle} action={action}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
    </MerchShelf>
  )
}

function LateNightPromoTile() {
  return (
    <div className="group relative flex aspect-[16/10] w-72 sm:w-80 md:w-[22rem] shrink-0 snap-start flex-col overflow-hidden rounded-lg ring-1 ring-border/80 shadow-xs bg-card p-4 justify-between select-none">
      <div className="absolute -right-6 -bottom-6 w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden shadow-md ring-2 ring-border/40 group-hover:scale-105">
        <img
          src="/images/categories/food.webp"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative z-10 max-w-[60%] pt-1">
        <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Late Night Cravings
        </span>
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
          Open late for delivery
        </p>
      </div>

      <div className="relative z-10">
        <span className="inline-flex items-center text-xs font-semibold text-primary">
          Order from local spots
        </span>
      </div>
    </div>
  )
}

function fallbackCoverForShop(shop: StoreVendor): string {
  const name = (shop.name || shop.slug || "").toLowerCase()
  if (name.includes("tech") || name.includes("phone") || name.includes("gadget")) return "/images/categories/electronics.webp"
  if (name.includes("koko") || name.includes("cuisine") || name.includes("food") || name.includes("mart") || name.includes("noodle")) return "/images/categories/food.webp"
  if (name.includes("beauty") || name.includes("skin") || name.includes("glow")) return "/images/categories/cosmetics.webp"
  return "/images/categories/fashion.jpg"
}

function StoreRailCard({ shop }: { shop: StoreVendor }) {
  const earnedTopRated =
    (shop.badges ?? []).some((b) => {
      if (typeof b === "string") return (b as string).toLowerCase().includes("top")
      return Boolean(b?.label?.toLowerCase().includes("top") || b?.id?.toLowerCase().includes("top"))
    }) ||
    (shop.ratingAvg != null && shop.ratingAvg >= 4.8)

  const isOpen = shop.availability !== "paused"
  const hasRating = shop.ratingAvg != null && (shop.ratingCount ?? 0) > 0
  const minutes = shop.deliveryMinutes ?? null
  const coverUrl = shop.banner || shop.logo || fallbackCoverForShop(shop)

  const statusRibbon = !isOpen ? "Closed" : null

  return (
    <article className="group flex flex-col w-full text-left">
      <Link
        to="/shops/$slug"
        params={{ slug: shop.slug }}
        aria-label={`Visit ${shop.name}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {/* 1. Media Container */}
        <div className="relative w-full overflow-hidden rounded-lg bg-muted/20 dark:bg-muted/40 aspect-[16/10] ring-1 ring-black/[0.04]">
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover group-hover:scale-105"
          />

          {earnedTopRated ? (
            <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-[6px] bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground shadow-xs">
              <ThumbsUp size={12} weight="fill" />
              <span>Top Rated</span>
            </div>
          ) : null}

          {statusRibbon ? (
            <div className="absolute inset-x-0 bottom-0 z-10 bg-[#E53935] text-white py-1 px-3 text-center text-xs font-bold tracking-wide">
              {statusRibbon}
            </div>
          ) : null}
        </div>

        {/* 2. Information Outside the Card */}
        <div className="flex flex-col pt-2.5 pb-0.5 gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm sm:text-base font-semibold text-foreground group-hover:text-primary">
              {shop.name}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-3 text-xs sm:text-[13px] text-muted-foreground">
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-foreground">
              <Star
                size={13}
                weight="fill"
                className={cn(
                  (shop.ratingAvg ?? 4) >= 4 ? "text-amber-500" : "text-muted-foreground/60",
                  "shrink-0",
                )}
              />
              <span>{hasRating ? shop.ratingAvg!.toFixed(1) : "New"}</span>
              {(shop.ratingCount ?? 0) > 0 ? (
              <span className="font-normal text-muted-foreground">({shop.ratingCount})</span>
              ) : null}
            </span>

            {minutes != null ? (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground">
              <Bicycle size={15} weight="bold" className="text-muted-foreground/90 shrink-0" />
              <span>{minutes}mins delivery</span>
            </span>
            ) : null}

            {!isOpen && !statusRibbon ? (
              <span className="font-bold text-xs text-muted-foreground">Closed</span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  )
}
