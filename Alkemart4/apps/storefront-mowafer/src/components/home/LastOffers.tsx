import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  Baby,
  Basket,
  Coffee,
  DeviceMobile,
  FirstAid,
  House,
  PawPrint,
  SquaresFour,
  SquaresFour as GridIcon,
  List,
  TShirt,
} from "@phosphor-icons/react"
import { Button, MerchEmpty, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ToggleGroup, ToggleGroupItem } from "@workspace/ui"
import { ProductCard } from "@/components/product/ProductCard"
import { ProductGridSkeleton } from "@/components/skeletons"
import type { StoreProductCard } from "@/lib/products"
import type { RailIconId } from "@/lib/catalog-nav"
import {
  availableOfferTabs,
  filterOffersByTab,
  sortOffers,
  tabSlug,
  type OfferSort,
  type OfferTabId,
  type OfferView,
} from "@/lib/offer-filter"
import { cn } from "@/lib/utils"

const ICONS: Record<RailIconId, typeof DeviceMobile> = {
  electronics: DeviceMobile,
  fashion: TShirt,
  home: House,
  health: FirstAid,
  baby: Baby,
  food: Basket,
  beverages: Coffee,
  pet: PawPrint,
  all: SquaresFour,
}

type Props = {
  products: StoreProductCard[]
  categories?: { handle?: string | null }[]
  loading?: boolean
  className?: string
}

export function LastOffers({ products, categories, loading, className }: Props) {
  const [tab, setTab] = useState<OfferTabId | "all">("all")
  const [sort, setSort] = useState<OfferSort>("featured")
  const [view, setView] = useState<OfferView>("grid")
  const tabs = useMemo(() => availableOfferTabs(categories ?? []), [categories])
  const visible = useMemo(() => sortOffers(filterOffersByTab(products, tab), sort), [products, tab, sort])

  return (
    <section
      id="last-offers"
      data-testid="section-last-offers"
      className={cn("scroll-mt-24 space-y-4", className)}
      aria-label="Last offers"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Last Offers</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Filter offers by category" className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = ICONS[t.icon] ?? SquaresFour
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={t.label}
                  title={t.label}
                  onClick={() => setTab(on ? "all" : t.id)}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-md transition sm:size-11",
                    on
                      ? "bg-muted text-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <Icon size={22} />
                </button>
              )
            })}
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {sort === "price_asc" ? "Price ↑" : sort === "price_desc" ? "Price ↓" : sort === "newest" ? "Newest" : "Featured"}
          </p>
          <Select value={sort} onValueChange={(v) => setSort(v as OfferSort)}>
            <SelectTrigger className="h-9 w-32 rounded-md" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">Featured</SelectItem>
              <SelectItem value="price_asc">Price ↑</SelectItem>
              <SelectItem value="price_desc">Price ↓</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as OfferView)}
            variant="outline"
            size="icon"
            aria-label="View mode"
          >
            <ToggleGroupItem value="grid" aria-label="Grid">
              <GridIcon size={16} />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List">
              <List size={16} />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {loading ? <ProductGridSkeleton count={8} view={view} /> : null}

      {!loading && visible.length > 0 ? (
        <div className="space-y-6">
          {view === "list" ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} size="row" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} size="tile" />
              ))}
            </div>
          )}
          <div className="flex justify-center">
            <Button variant="outline" className="rounded-full" asChild>
              <Link to="/categories/$slug" params={{ slug: tabSlug(tab) }}>
                View More
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && visible.length === 0 ? (
        <MerchEmpty
          title={tab === "all" ? "No offers yet" : "Nothing in this tab"}
          body="Priced listings from sellers appear here when the catalog has them."
          action={
            tab !== "all" ? (
              <Button variant="outline" className="rounded-full" onClick={() => setTab("all")}>
                Show all
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full" asChild>
                <Link to="/categories/$slug" params={{ slug: "all" }}>
                  Browse
                </Link>
              </Button>
            )
          }
        />
      ) : null}
    </section>
  )
}
