import type { HomeSection } from "@alkemart/shared/homepage"
import { SectionHeader } from "@/components/commerce/section-header"
import { StoreCard, StoreCardSkeleton } from "@/components/commerce/store-card"
import { distanceKm, readPin } from "@/lib/nearby"
import { useStoreRail } from "@/hooks/use-shelf"

type StoreRailSection = Extract<HomeSection, { type: "store_rail" }>

/** "Meet the people behind the products" — the shops, not just their stock. */
export function StoreRailSection({ section }: { section: StoreRailSection }) {
  const { shops, ranked, loading } = useStoreRail(section.source, section.limit, section.sellerHandles)
  if (!loading && shops.length === 0) return null
  // A ranking title ("Top rated shops") is only honest when something was ranked.
  const title = ranked ? section.title : "Meet the people behind the products"
  const pin = readPin()
  return (
    <section className="container-page" aria-label={title}>
      <SectionHeader
        title={title}
        subtitle={ranked ? section.subtitle : "Independent sellers, all in one place."}
        action={{ label: "See all stores", to: "/shops" }}
      />
      <div className="rail -mx-4 scroll-px-4 px-4 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {(loading ? Array.from({ length: 4 }, () => null) : shops).map((s, i) => (
          <div key={s?.slug ?? i} className="w-[80%] shrink-0 sm:w-[46%] lg:w-[24%]">
            {s ? <StoreCard shop={s} distanceKm={distanceKm(pin, s)} className="h-full" /> : <StoreCardSkeleton />}
          </div>
        ))}
      </div>
    </section>
  )
}
