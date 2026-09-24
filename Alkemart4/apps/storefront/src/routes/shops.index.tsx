import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  Bicycle,
  DeviceMobile,
  FirstAid,
  ForkKnife,
  MagnifyingGlass,
  MapPin,
  ShoppingCartSimple,
  Star,
  Storefront,
  ThumbsUp,
  TShirt,
} from "@phosphor-icons/react"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import {
  distanceKm, formatDistance, readPin, sortByDistance, type BuyerPin,
} from "@/lib/nearby"
import { DeliverToPicker } from "@/components/shell/DeliverToPicker"
import { useDeliverTo, matchesArea } from "@/lib/deliver-to"
import { Skeleton } from "@/components/skeleton"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/shops/")({
  component: ShopsPage,
})

type SortKey = "recommended" | "nearest" | "rating" | "fastest" | "name"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "rating", label: "Top rated" },
  { key: "nearest", label: "Nearest" },
  { key: "fastest", label: "Fastest" },
  { key: "name", label: "A–Z" },
]

const CATEGORY_TABS = [
  { id: "all", label: "All Stores", icon: Storefront },
  { id: "groceries", label: "Supermarkets", icon: ShoppingCartSimple },
  { id: "food", label: "Food & Dining", icon: ForkKnife },
  { id: "tech", label: "Phones & Tech", icon: DeviceMobile },
  { id: "fashion", label: "Fashion & Beauty", icon: TShirt },
  { id: "pharmacy", label: "Health & Pharmacy", icon: FirstAid },
] as const

type StoreCategoryId = (typeof CATEGORY_TABS)[number]["id"]

function getVendorCategory(vendor: StoreVendor): StoreCategoryId {
  const text = `${vendor.name} ${vendor.tagline ?? ""} ${vendor.bio ?? ""}`.toLowerCase()
  if (
    text.includes("koko") ||
    text.includes("noodle") ||
    text.includes("cuisine") ||
    text.includes("food") ||
    text.includes("bakery") ||
    text.includes("restaurant") ||
    text.includes("cafe") ||
    text.includes("chop")
  ) {
    return "food"
  }
  if (
    text.includes("grocer") ||
    text.includes("mart") ||
    text.includes("market") ||
    text.includes("supermarket")
  ) {
    return "groceries"
  }
  if (
    text.includes("tech") ||
    text.includes("phone") ||
    text.includes("gadget") ||
    text.includes("electronic") ||
    text.includes("apple") ||
    text.includes("samsung")
  ) {
    return "tech"
  }
  if (
    text.includes("fashion") ||
    text.includes("cloth") ||
    text.includes("wear") ||
    text.includes("boutique") ||
    text.includes("beauty") ||
    text.includes("cosmetic") ||
    text.includes("glamour")
  ) {
    return "fashion"
  }
  if (
    text.includes("pharmacy") ||
    text.includes("health") ||
    text.includes("med") ||
    text.includes("drug")
  ) {
    return "pharmacy"
  }
  return "all"
}

function fallbackCoverForShop(shop: StoreVendor): string {
  const name = (shop.name || shop.slug || "").toLowerCase()
  if (name.includes("tech") || name.includes("phone") || name.includes("gadget"))
    return "/images/categories/electronics.webp"
  if (
    name.includes("koko") ||
    name.includes("cuisine") ||
    name.includes("food") ||
    name.includes("mart") ||
    name.includes("noodle")
  )
    return "/images/categories/food.webp"
  if (name.includes("beauty") || name.includes("skin") || name.includes("glow"))
    return "/images/categories/cosmetics.webp"
  return "/images/categories/fashion.jpg"
}

export function ShopsPage() {
  const [area] = useDeliverTo()
  const [query, setQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<StoreCategoryId>("all")
  const [sort, setSort] = useState<SortKey>("recommended")
  // The buyer's pin lives in this browser only; distance is computed here
  // against shop coordinates that are already public on the shop page.
  const [pin, setPin] = useState(() => readPin())
  useEffect(() => {
    const sync = () => setPin(readPin())
    window.addEventListener("alkemart:pin", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("alkemart:pin", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])
  const [openOnly, setOpenOnly] = useState(false)
  const [minRating, setMinRating] = useState(false)
  const [fastDelivery, setFastDelivery] = useState(false)

  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    staleTime: 300_000,
  })

  const allVendors = useMemo(() => {
    // Real shops only — no demo filler in production.
    return (vendorsQ.data ?? []).filter((v) => v.availability !== "paused")
  }, [vendorsQ.data])

  const filteredShops = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = allVendors

    // Category filter
    if (selectedCategory !== "all") {
      list = list.filter((v) => getVendorCategory(v) === selectedCategory)
    }

    // Text search
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.location ?? "").toLowerCase().includes(q) ||
          (s.tagline ?? "").toLowerCase().includes(q),
      )
    }

    // Toggles
    if (openOnly) {
      list = list.filter((s) => s.availability !== "paused")
    }
    if (minRating) {
      list = list.filter((s) => (s.ratingAvg ?? 0) >= 4.5)
    }
    if (fastDelivery) {
      list = list.filter((s) => (s.deliveryMinutes ?? 60) <= 45)
    }

    // Sort
    const sorted = [...list]
    switch (sort) {
      case "rating":
        sorted.sort((a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1))
        break
      case "nearest":
        return sortByDistance(sorted, pin)
      case "fastest":
        sorted.sort(
          (a, b) =>
            (a.deliveryMinutes ?? Number.POSITIVE_INFINITY) -
            (b.deliveryMinutes ?? Number.POSITIVE_INFINITY),
        )
        break
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      default:
        // Area match boost, then rating, then name
        sorted.sort((a, b) => {
          const areaA = matchesArea(a.location, area) ? 2 : 0
          const areaB = matchesArea(b.location, area) ? 2 : 0
          if (areaB !== areaA) return areaB - areaA
          const r = (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1)
          return r !== 0 ? r : a.name.localeCompare(b.name)
        })
    }
    return sorted
  }, [allVendors, query, selectedCategory, openOnly, minRating, fastDelivery, sort, area])

  const featuredShops = useMemo(() => {
    return allVendors
      .filter((s) => (s.ratingAvg ?? 0) >= 4.5 || (s.deliveryMinutes ?? 60) <= 45)
      .slice(0, 6)
  }, [allVendors])

  return (
    <div className="space-y-7 pb-10">
      {/* Header with Neighborhood Delivery Indicator */}
      <header className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 pt-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
          Stores
        </h1>
        <div className="flex items-center gap-2">
          <DeliverToPicker />
        </div>
      </header>

      {/* Category Filter Pills (DoorDash / Hubtel pattern) */}
      <section aria-label="Store Categories" className="space-y-1">
        <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon
            const active = selectedCategory === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold shrink-0",
                  active
                    ? "bg-foreground text-background font-bold shadow-xs"
                    : "border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon size={16} weight={active ? "bold" : "regular"} className="shrink-0" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Featured & Fastest Rail (when on All Stores and no query) */}
      {featuredShops.length > 0 && selectedCategory === "all" && !query.trim() ? (
        <section aria-label="Featured stores" className="space-y-3.5 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Featured & Fastest Near You
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Top-rated sellers delivering swiftly in your area.
              </p>
            </div>
          </div>
          <div className="scrollbar-none flex snap-x gap-4 overflow-x-auto pb-2">
            {featuredShops.map((shop) => (
              <div key={shop.slug} className="w-72 sm:w-80 md:w-[22rem] shrink-0 snap-start">
                <ShopGridCard shop={shop} pin={pin} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Search & Quick Operational Toggles */}
      <section aria-label="Store controls" className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between">
          {/* Search Bar */}
          <div className="relative min-w-0 flex-1 max-w-xl">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/80"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stores by name, category, or area..."
              aria-label="Search stores"
              className={cn(
                "h-11 w-full rounded-lg border border-border/80 bg-background/80 shadow-2xs",
                "py-2 pl-10 pr-4 text-sm font-medium text-foreground outline-none",
                "placeholder:text-muted-foreground/75",
                "focus:border-primary focus:bg-background focus-visible:ring-2 focus-visible:ring-primary/20",
              )}
            />
          </div>

          {/* Quick Filter Pills & Sorting */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-wrap">
            <button
              type="button"
              onClick={() => setOpenOnly((v) => !v)}
              aria-pressed={openOnly}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-xs sm:text-sm font-semibold",
                openOnly
                  ? "border-foreground bg-foreground text-background font-bold shadow-2xs"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Open now
            </button>
            <button
              type="button"
              onClick={() => setMinRating((v) => !v)}
              aria-pressed={minRating}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-xs sm:text-sm font-semibold",
                minRating
                  ? "border-foreground bg-foreground text-background font-bold shadow-2xs"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              ⭐ 4.5+ Rating
            </button>
            <button
              type="button"
              onClick={() => setFastDelivery((v) => !v)}
              aria-pressed={fastDelivery}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-xs sm:text-sm font-semibold",
                fastDelivery
                  ? "border-foreground bg-foreground text-background font-bold shadow-2xs"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              🚲 ≤ 45 mins
            </button>

            <span className="hidden sm:inline-block h-4 w-px bg-border/80 mx-1" aria-hidden />

            {/* Sort Options */}
            {SORTS.filter((s) => s.key !== "nearest" || pin).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                aria-pressed={sort === s.key}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3 text-xs sm:text-sm font-semibold",
                  sort === s.key
                    ? "border-primary bg-primary text-primary-foreground font-bold shadow-2xs"
                    : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Directory Grid */}
      <section aria-label="All stores" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
            {filteredShops.length} {filteredShops.length === 1 ? "store" : "stores"} available
          </p>
        </div>

        {vendorsQ.isLoading && !filteredShops.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="aspect-[16/10] w-full rounded-lg" />
                <div className="space-y-2 pt-2.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {filteredShops.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredShops.map((shop) => (
              <li key={shop.slug}>
                <ShopGridCard shop={shop} pin={pin} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-border/80 bg-card p-10 text-center space-y-3">
            <p className="text-base font-bold text-foreground">No stores match your search</p>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Try adjusting your filters, selecting &quot;All Stores&quot;, or searching for another area like Osu, East Legon, or Kumasi.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setSelectedCategory("all")
                setOpenOnly(false)
                setMinRating(false)
                setFastDelivery(false)
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-foreground px-4 text-xs font-bold text-background  hover:opacity-90"
            >
              Reset all filters
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * 16:10 Landscape Store Card matching homepage standard
 */
function ShopGridCard({ shop, pin }: { shop: StoreVendor; pin: BuyerPin | null }) {
  // Distance only appears when both sides have a pin. A shop that has not set
  // one shows its area as before rather than an apologetic blank.
  const away = formatDistance(distanceKm(pin, shop))
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
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
      >
        {/* 1. 16:10 Media Container */}
        <div className="relative w-full overflow-hidden rounded-lg bg-muted/20 aspect-[16/10] ring-1 ring-black/[0.04]">
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
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

        {/* 2. Decoupled Outside Information */}
        <div className="flex flex-col pt-3 pb-1 gap-1">
          {/* Row 1: Name */}
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-base font-bold text-foreground group-hover:text-primary">
              {shop.name}
            </h2>
          </div>

          {/* Row 2: Ratings + Bicycle Delivery Indicator */}
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

          {/* Row 3: Location / Area Tag */}
          {shop.location || away ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground/80 truncate pt-0.5">
              <MapPin size={12} weight="fill" className="shrink-0 text-muted-foreground/60" />
              <span className="truncate">{shop.location}</span>
              {away ? (
                <span className="shrink-0 font-bold text-foreground">
                  {shop.location ? "· " : ""}
                  {away}
                </span>
              ) : null}
            </p>
          ) : null}

          {/* Featured items preview strip */}
          {shop.featured && shop.featured.length > 0 ? (
            <div className="flex items-center gap-2 pt-1.5 overflow-x-auto scrollbar-none">
              {shop.featured.slice(0, 3).map((item) => (
                <div
                  key={item.productId}
                  title={item.title}
                  className="size-11 shrink-0 rounded-lg overflow-hidden border border-border/80 bg-muted/30"
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </article>
  )
}

