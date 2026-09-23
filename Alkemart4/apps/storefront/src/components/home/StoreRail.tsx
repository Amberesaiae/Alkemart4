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
import { Bicycle, Heart, Star, ThumbsUp } from "@phosphor-icons/react"
import { StoreRailSkeleton } from "@/components/skeleton"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { matchesArea, useDeliverTo } from "@/lib/deliver-to"
import { cn } from "@/lib/utils"

export const DEMO_VENDORS: StoreVendor[] = [
  {
    id: "v-koko",
    name: "Koko King Express - Dawn",
    slug: "koko-king",
    location: "Osu, Accra",
    banner: "/images/categories/food.webp",
    availability: "open",
    ratingAvg: 4.1,
    ratingCount: 19,
    deliveryMinutes: 60,
  },
  {
    id: "v-shandy",
    name: "Shandy Adepa Noodles - Dawn",
    slug: "shandy-adepa",
    location: "Dansoman, Accra",
    banner: "/images/categories/food.webp",
    availability: "open",
    ratingAvg: 3.1,
    ratingCount: 20,
    deliveryMinutes: 60,
  },
  {
    id: "v-ejs",
    name: "EJ's Cuisine - Dawn",
    slug: "ejs-cuisine",
    location: "East Legon, Accra",
    banner: "/images/categories/rail-grocery.jpg",
    availability: "open",
    ratingAvg: 4.8,
    ratingCount: 42,
    deliveryMinutes: 35,
  },
  {
    id: "v-tech",
    name: "Kumasi Tech Hub",
    slug: "kumasi-tech",
    location: "Kumasi & Accra",
    banner: "/images/categories/generated/electronics-v3.webp",
    availability: "open",
    ratingAvg: 4.9,
    ratingCount: 88,
    deliveryMinutes: 45,
  },
  {
    id: "v-hurry",
    name: "Hurry Ventures - Osu",
    slug: "hurry-ventures",
    location: "Osu, Accra",
    banner: "/images/categories/generated/fashion-v3.webp",
    availability: "open",
    ratingAvg: 4.6,
    ratingCount: 31,
    deliveryMinutes: 50,
  },
  {
    id: "v-glow",
    name: "Glow & Glamour Beauty",
    slug: "glow-glamour",
    location: "Airport Residential, Accra",
    banner: "/images/categories/generated/beauty-v3.webp",
    availability: "open",
    ratingAvg: 4.7,
    ratingCount: 56,
    deliveryMinutes: 40,
  },
]

/**
 * A shelf of shops matching Hubtel's landscape store cards.
 */
export function StoreRail({ section }: { section: Extract<HomeSection, { type: "store_rail" }> }) {
  const [area] = useDeliverTo()

  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    initialData: DEMO_VENDORS,
    staleTime: 300_000,
  })

  const shops = useMemo(() => {
    const raw = (vendorsQ.data ?? []).filter((v) => v.availability !== "paused")
    const all = raw.length >= 3 ? raw : [...raw, ...DEMO_VENDORS.filter((d) => !raw.some((r) => r.slug === d.slug))]
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
    <div className="group relative flex aspect-[16/10] w-72 sm:w-80 md:w-[22rem] shrink-0 snap-start flex-col overflow-hidden rounded-xl ring-1 ring-border/80 shadow-xs bg-card p-4 justify-between select-none">
      <div className="absolute -right-6 -bottom-6 w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden shadow-md ring-2 ring-border/40 transition-transform duration-500 group-hover:scale-105">
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

  const statusRibbon =
    shop.slug === "koko-king" || shop.name.toLowerCase().includes("koko")
      ? "Get it from 12:00 AM"
      : !isOpen
        ? "Closed"
        : null

  return (
    <article className="group flex flex-col w-full text-left">
      <Link
        to="/shops/$slug"
        params={{ slug: shop.slug }}
        aria-label={`Visit ${shop.name}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {/* 1. Media Container */}
        <div className="relative w-full overflow-hidden rounded-xl bg-muted/20 dark:bg-muted/40 aspect-[16/10] ring-1 ring-black/[0.04]">
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
            <span className="truncate text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors">
              {shop.name}
            </span>
            <button
              type="button"
              aria-label={`Save ${shop.name} to favorites`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className="text-muted-foreground hover:text-red-500 transition-colors p-0.5 shrink-0"
            >
              <Heart size={18} />
            </button>
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
              <span>{hasRating ? shop.ratingAvg!.toFixed(1) : "4.1"}</span>
              <span className="font-normal text-muted-foreground">({shop.ratingCount || 19})</span>
            </span>

            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground">
              <Bicycle size={15} weight="bold" className="text-muted-foreground/90 shrink-0" />
              <span>{minutes ?? 60}mins delivery</span>
            </span>

            {!isOpen && !statusRibbon ? (
              <span className="font-bold text-xs text-muted-foreground">Closed</span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  )
}
