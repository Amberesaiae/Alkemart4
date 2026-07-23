import { useMemo, useState } from "react"
import { ProductCard } from "@/components/product-card"
import { EmptyState } from "@/components/empty-state"
import { LastOffersSkeleton } from "@/components/skeleton"
import { ProductGridShell } from "@/components/product-grid"
import { ViewMore } from "@/components/shell/ViewMore"
import {
  LastOffersTabs,
  type OfferSort,
  type OfferTabId,
  type OfferView,
} from "@/components/home/LastOffersTabs"
import { filterOffersByTab, sortOffers } from "@/lib/offer-filter"
import type { StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"

type Props = {
  products: StoreProductCard[]
  loading?: boolean
  className?: string
}

/**
 * Last Offers — same 4-up product grid as PLP / search / store.
 * Tabs + sort only; no oversized hero hierarchy.
 */
export function HomeLastOffers({ products, loading, className }: Props) {
  const [tab, setTab] = useState<OfferTabId | "all">("all")
  const [sort, setSort] = useState<OfferSort>("featured")
  const [view, setView] = useState<OfferView>("grid")

  const visible = useMemo(() => {
    const filtered = filterOffersByTab(products, tab)
    return sortOffers(filtered, sort)
  }, [products, tab, sort])

  return (
    <section
      id="last-offers"
      className={cn("scroll-mt-24 space-y-4", className)}
      aria-label="Last offers"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="type-section text-foreground">Last Offers</h2>
      </div>

      <LastOffersTabs
        active={tab}
        onChange={setTab}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
      />

      {loading ? <LastOffersSkeleton count={4} /> : null}

      {!loading && visible.length > 0 ? (
        <div className="space-y-4">
          {view === "list" ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} size="row" />
              ))}
            </div>
          ) : (
            <ProductGridShell>
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} size="tile" />
              ))}
            </ProductGridShell>
          )}

          <ViewMore
            to="/categories/$slug"
            params={{ slug: tabSlug(tab) }}
            label="View more"
          />
        </div>
      ) : null}

      {!loading && visible.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            illustration="emptyCatalog"
            title={tab === "all" ? "No offers yet" : `No ${tab} offers`}
            description={
              tab === "all" ? "No priced listings yet." : "Nothing in this tab."
            }
            actionLabel={tab === "all" ? "Browse" : "Show all"}
            actionTo={tab === "all" ? "/categories/$slug" : undefined}
            actionParams={tab === "all" ? { slug: "all" } : undefined}
          />
          {tab !== "all" ? (
            <ViewMore label="Show all" onClick={() => setTab("all")} />
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function tabSlug(tab: OfferTabId | "all"): string {
  switch (tab) {
    case "electronics":
      return "phones-electronics"
    case "food":
    case "beverages":
      return "food-groceries"
    case "personal":
      return "health-beauty"
    case "pet":
      return "pet-care"
    case "baby":
      return "baby-kids"
    default:
      return "all"
  }
}
