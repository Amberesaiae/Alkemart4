import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Storefront } from "@phosphor-icons/react"
import {
  Button,
  Input,
  MerchEmpty,
  StoreCardArt,
  StoreCardBadges,
  StoreCardFacts,
  StoreCardFeaturedStrip,
  storeCardShell,
} from "@workspace/ui"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { listStoreProducts } from "@/lib/products"
import { ShopGridSkeleton } from "@/components/skeletons"
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

function ShopsPage() {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<SortKey>("recommended")
  const [openOnly, setOpenOnly] = useState(false)

  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    staleTime: 60_000,
  })

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
    <div className="space-y-5" data-testid="section-stores">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Shops selling on alkemart. Open one to browse everything they stock.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shops by name or area"
            aria-label="Search shops"
            className="h-11 rounded-full pl-4"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          {SORTS.map((s) => (
            <Button
              key={s.key}
              type="button"
              variant={sort === s.key ? "default" : "outline"}
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className="h-9 shrink-0 rounded-full px-3.5"
              size="sm"
            >
              {s.label}
            </Button>
          ))}
          {hasAnyPaused ? (
            <Button
              type="button"
              variant={openOnly ? "default" : "outline"}
              onClick={() => setOpenOnly((v) => !v)}
              aria-pressed={openOnly}
              className="h-9 shrink-0 rounded-full px-3.5"
              size="sm"
            >
              Open now
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? <ShopGridSkeleton count={6} /> : null}

      {vendorsQ.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {vendorsQ.error instanceof Error ? vendorsQ.error.message : "Could not load shops"}
        </p>
      ) : null}

      {!loading && all.length === 0 ? (
        <MerchEmpty
          title="No shops to show yet"
          body="No open shops yet."
          action={
            <Button className="rounded-full" asChild>
              <Link to="/">Browse products</Link>
            </Button>
          }
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
            title={item.title}
            className="block size-12 overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
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
