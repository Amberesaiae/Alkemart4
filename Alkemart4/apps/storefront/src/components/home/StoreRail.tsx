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
import { Heart, Motorcycle, Star, ThumbsUp } from "@phosphor-icons/react"
import { StoreRailSkeleton } from "@/components/skeleton"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { matchesArea, useDeliverTo } from "@/lib/deliver-to"
import { cn } from "@/lib/utils"

export const DEMO_VENDORS: StoreVendor[] = [
  {
    id: "v-ejs",
    name: "EJ's Cuisine - Dawn",
    slug: "ejs-cuisine",
    location: "East Legon, Accra",
    banner: "/images/categories/rail-grocery.jpg",
    availability: "open",
  },
  {
    id: "v-koko",
    name: "Koko King Express - Dawn",
    slug: "koko-king",
    location: "Osu, Accra",
    banner: "/images/products/demo/glass-containers.jpg",
    availability: "open",
  },
  {
    id: "v-tech",
    name: "Kumasi Tech Hub",
    slug: "kumasi-tech",
    location: "Kumasi & Accra",
    banner: "/images/categories/generated/electronics-v3.webp",
    availability: "open",
  },
  {
    id: "v-hurry",
    name: "Hurry Ventures - Osu",
    slug: "hurry-ventures",
    location: "Osu, Accra",
    banner: "/images/categories/generated/fashion-v3.webp",
    availability: "open",
  },
  {
    id: "v-glow",
    name: "Glow & Glamour Beauty",
    slug: "glow-glamour",
    location: "Airport Residential, Accra",
    banner: "/images/categories/generated/beauty-v3.webp",
    availability: "open",
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

  if (section.layout === "carousel") {
    return (
      <MerchShelf title={section.title} subtitle={section.subtitle} layout="carousel">
        {shown.map((shop) => (
          <div key={shop.slug} className="w-52 shrink-0 snap-start sm:w-56">
            <StoreRailCard shop={shop} square />
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

function fallbackCoverForShop(shop: StoreVendor): string {
  const name = (shop.name || shop.slug || "").toLowerCase()
  if (name.includes("tech") || name.includes("phone") || name.includes("gadget")) return "/images/categories/electronics.webp"
  if (name.includes("koko") || name.includes("cuisine") || name.includes("food") || name.includes("mart")) return "/images/categories/food.webp"
  if (name.includes("beauty") || name.includes("skin") || name.includes("glow")) return "/images/categories/cosmetics.webp"
  return "/images/categories/fashion.jpg"
}

function StoreRailCard({ shop, square = false }: { shop: StoreVendor; square?: boolean }) {
  // A badge is something the shop earned (from the API), not something we
  // derive from a rating we may not even have.
  const earnedTopRated = (shop.badges ?? []).some((b) => {
    if (typeof b === "string") return (b as string).toLowerCase().includes("top")
    return Boolean(b?.label?.toLowerCase().includes("top") || b?.id?.toLowerCase().includes("top"))
  })
  const isOpen = shop.availability !== "paused"
  const hasRating = shop.ratingAvg != null && (shop.ratingCount ?? 0) > 0
  const minutes = shop.deliveryMinutes ?? null
  const coverUrl = shop.banner || shop.logo || fallbackCoverForShop(shop)

  return (
    <article className="group flex flex-col w-full">
      <Link
        to="/shops/$slug"
        params={{ slug: shop.slug }}
        aria-label={`Visit ${shop.name}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <div className={cn(
          "relative w-full overflow-hidden rounded-2xl bg-[#F2F4F7] dark:bg-muted/40 ring-1 ring-black/[0.04]",
          square ? "aspect-square" : "aspect-[16/9]",
        )}>
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {earnedTopRated ? (
            <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1 rounded-[6px] bg-[#00A99D] px-2 py-0.5 text-xs font-bold text-white shadow-xs">
              <ThumbsUp size={12} weight="fill" />
              <span>Top Rated</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col pt-2 pb-0.5 gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm sm:text-base font-bold text-gray-900 group-hover:text-[#00A99D] transition-colors dark:text-gray-100">
              {shop.name}
            </span>
            <button
              type="button"
              aria-label="Save to favorites"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
            >
              <Heart size={18} />
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400">
            {/* Facts only when they exist — a card that invents a 4.8 and a
                "Closing Soon" teaches buyers to distrust every card. */}
            {hasRating ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap font-bold text-[#00A99D]">
                <Star size={13} weight="fill" className="text-[#00A99D]" />
                <span>{shop.ratingAvg!.toFixed(1)}</span>
                <span className="font-normal text-muted-foreground">({shop.ratingCount})</span>
              </span>
            ) : null}

            {minutes != null ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-gray-500">
                <Motorcycle size={14} className="text-gray-400" />
                <span>{minutes} mins delivery</span>
              </span>
            ) : null}

            {!isOpen ? (
              <span className="font-bold text-xs text-gray-400">Closed</span>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  )
}
