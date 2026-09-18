import { useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  StoreCardArt,
  StoreCardBadges,
  StoreCardFacts,
  StoreCardFeaturedStrip,
  storeCardShell,
} from "@workspace/ui"
import { MagnifyingGlass, Storefront } from "@phosphor-icons/react"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { listStoreProducts } from "@/lib/products"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"
import { formatMoney } from "@/lib/cart"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/shops/")({
  component: ShopsPage,
})

type SortKey = "recommended" | "rating" | "fastest" | "name"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "rating", label: "Top rated" },
  { key: "fastest", label: "Fastest" },
  { key: "name", label: "A–Z" },
]

/**
 * The Stores destination.
 *
 * A multi-vendor marketplace's hardest question is not "what should I buy"
 * but "which of these strangers should I buy from". So each card leads with
 * the shop's own art, then the facts that answer it — rating, delivery band,
 * what it has earned — and closes with the items the vendor picked to lead
 * with, which turns a directory of names into a browsable market.
 */
function ShopsPage() {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("recommended")
  const [openOnly, setOpenOnly] = useState(false)

  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
  })

  /* Legacy fallback: derive shop names from the catalogue when the sellers
     endpoint is unavailable. Such rows carry no trust facts, and the cards
     correctly show none rather than filling in blanks. */
  const productsQ = useQuery({
    queryKey: ["store", "products", "for-seller-index"],
    queryFn: () => listStoreProducts({ limit: 48 }),
    enabled: vendorsQ.isSuccess && (vendorsQ.data?.length ?? 0) === 0,
  })

  const fromApi = vendorsQ.data ?? []
  const fromProducts = useMemo<StoreVendor[]>(() => {
    if (fromApi.length) return []
    const map = new Map<string, StoreVendor>()
    for (const p of productsQ.data?.products ?? []) {
      const name = p.seller?.name?.trim()
      const slug = p.seller?.handle?.trim()
      if (!name || !slug || map.has(slug)) continue
      map.set(slug, { id: slug, name, slug })
    }
    return [...map.values()]
  }, [fromApi.length, productsQ.data])

  const all = fromApi.length > 0 ? fromApi : fromProducts

  const shops = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = all
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.location ?? "").toLowerCase().includes(q) ||
          (s.tagline ?? "").toLowerCase().includes(q),
      )
    }
    if (openOnly) list = list.filter((s) => s.availability !== "paused")

    const sorted = [...list]
    switch (sort) {
      case "rating":
        // Unrated shops sort last rather than as zero — they are unknown,
        // not bad.
        sorted.sort((a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1))
        break
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
        // Open shops with something to show first, then by rating, then name.
        sorted.sort((a, b) => {
          const score = (s: StoreVendor) =>
            (s.availability === "paused" ? 0 : 2) + ((s.featured?.length ?? 0) > 0 ? 1 : 0)
          const d = score(b) - score(a)
          if (d !== 0) return d
          const r = (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1)
          return r !== 0 ? r : a.name.localeCompare(b.name)
        })
    }
    return sorted
  }, [all, query, sort, openOnly])

  const loading =
    vendorsQ.isLoading ||
    (vendorsQ.isSuccess && (vendorsQ.data?.length ?? 0) === 0 && productsQ.isLoading)

  const hasAnyPaused = all.some((s) => s.availability === "paused")

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="eyebrow text-muted-foreground">Marketplace</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Stores</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Shops selling on alkemart. Open one to browse everything they stock.
        </p>
      </header>

      {/* Controls stay mounted while results load, so filtering never jumps. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shops by name or area"
            aria-label="Search shops"
            className={cn(
              "h-11 w-full rounded-full border border-border bg-muted/40 pl-10 pr-4 text-sm",
              "outline-none placeholder:text-muted-foreground",
              "focus:border-primary focus:bg-card focus-visible:ring-2 focus-visible:ring-primary/30",
            )}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                sort === s.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
          {hasAnyPaused ? (
            <button
              type="button"
              onClick={() => setOpenOnly((v) => !v)}
              aria-pressed={openOnly}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                openOnly
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Open now
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-64 w-full rounded-2xl" />
            </li>
          ))}
        </ul>
      ) : null}

      {vendorsQ.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {vendorsQ.error instanceof Error ? vendorsQ.error.message : "Could not load shops"}
        </p>
      ) : null}

      {!loading && all.length === 0 ? (
        <EmptyState
          illustration="marketplace"
          title="No shops to show yet"
          description="No open shops yet."
          actionLabel="Browse products"
          actionTo="/"
        />
      ) : null}

      {!loading && all.length > 0 && shops.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No shops match “{query.trim()}”. Try a shop name or an area like Osu or Madina.
        </p>
      ) : null}

      {shops.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {shops.length} {shops.length === 1 ? "shop" : "shops"}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <li key={shop.slug}>
                <ShopCard shop={shop} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function ShopCard({ shop }: { shop: StoreVendor }) {
  const paused = shop.availability === "paused"
  return (
    <article className={cn(storeCardShell, paused && "opacity-75")}>
      <Link
        to="/shops/$slug"
        params={{ slug: shop.slug }}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Visit ${shop.name}`}
      >
        <StoreCardArt
          src={shop.banner ?? shop.logo}
          className="aspect-[16/9]"
          fallback={<Storefront size={40} aria-hidden />}
        />
        <div className="flex flex-col gap-1.5 p-3.5 pb-3">
          <h2 className="truncate text-base font-bold tracking-tight">{shop.name}</h2>
          {shop.location ? (
            <p className="truncate text-xs text-muted-foreground">{shop.location}</p>
          ) : null}
          <StoreCardFacts store={shop} />
          <StoreCardBadges badges={shop.badges} className="pt-0.5" />
        </div>
      </Link>

      <StoreCardFeaturedStrip
        items={shop.featured}
        className="px-3.5 pb-3.5"
        renderItem={(item) => (
          <Link
            to="/product/$id"
            params={{ id: item.productId }}
            title={`${item.title} — ${formatMoney(Number(item.fromPricePesewas) / 100, "ghs")}`}
            className={cn(
              "block size-12 overflow-hidden rounded-lg border border-border bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="sr-only">{item.title}</span>
            )}
          </Link>
        )}
      />
    </article>
  )
}
