import { useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Location01Icon } from "@hugeicons/core-free-icons"
import { StoreCard, StoreCardSkeleton } from "@/components/commerce/store-card"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { listStoreVendors, type StoreVendor } from "@/lib/vendors"
import { distanceKm, readPin, requestPin, sortByDistance } from "@/lib/nearby"
import { matchesArea, useDeliverTo } from "@/lib/deliver-to"
import { FAST_DELIVERY_MAX_MINUTES } from "@alkemart/shared/storefront-badges"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/shops/")({
  component: StoresPage,
})

type Sort = "recommended" | "nearest" | "rating" | "name"

/** Fast = a same-day band, or a promise of delivery within a day. */
const isFast = (s: StoreVendor) =>
  (s.deliveryMinutes != null && s.deliveryMinutes <= FAST_DELIVERY_MAX_MINUTES) || (s.deliveryDays != null && s.deliveryDays.max <= 1)
/** Comparable delivery time in hours (unknown last). */
const deliveryHours = (s: StoreVendor) => (s.deliveryMinutes != null ? s.deliveryMinutes / 60 : s.deliveryDays ? s.deliveryDays.max * 24 : Infinity)

/**
 * Stores directory. The shops are the content, so they start right under
 * the title — no banner, no promise cards. Finding a shop by name is the
 * header search's job (it suggests shops as you type); here, one row of
 * chips narrows and orders the list.
 */
function StoresPage() {
  const [area] = useDeliverTo()
  const [sort, setSort] = useState<Sort>("recommended")
  const [onlyArea, setOnlyArea] = useState(false)
  const [fast, setFast] = useState(false)
  const [pin, setPin] = useState(() => readPin())
  useEffect(() => {
    const sync = () => setPin(readPin())
    window.addEventListener("alkemart:pin", sync)
    return () => window.removeEventListener("alkemart:pin", sync)
  }, [])

  const q = useQuery({ queryKey: ["store", "vendors"], queryFn: listStoreVendors, staleTime: 300_000 })
  const all = useMemo(() => (q.data ?? []).filter((v) => v.availability !== "paused"), [q.data])
  const shops = useMemo(() => {
    let list = all
    if (onlyArea && area) list = list.filter((s) => matchesArea(s.location, area))
    if (fast) list = list.filter(isFast)
    const sorted = [...list]
    switch (sort) {
      case "rating":
        return sorted.sort((a, b) => (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
      case "nearest":
        return sortByDistance(sorted, pin)
      case "name":
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      default:
        // Recommended: shops in the buyer's area first, then rating, then speed.
        return sorted.sort(
          (a, b) =>
            Number(matchesArea(b.location, area) && !!area) - Number(matchesArea(a.location, area) && !!area) ||
            (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) ||
            deliveryHours(a) - deliveryHours(b),
        )
    }
  }, [all, sort, onlyArea, fast, area, pin])

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
      active ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-muted",
    )
  const nearMe = async () => {
    if (!pin) {
      const got = await requestPin().catch(() => null)
      if (!got) return
      setPin(got)
    }
    setSort("nearest")
  }

  return (
    <div className="container-page space-y-5 pt-5 pb-10 sm:space-y-6 sm:pt-8">
      <PageSeo title="Stores" description="Independent sellers and trusted shops — see delivery times, ratings and verification before you buy." path="/shops" />
      <header>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Stores</h1>
          <p className="mt-1 text-muted-foreground">
            {q.isLoading ? "Finding shops…" : `${shops.length} shop${shops.length === 1 ? "" : "s"}${onlyArea && area ? ` in ${area}` : ""} · delivery times and reviews up front`}
          </p>
        </div>
      </header>

      <div role="toolbar" aria-label="Filter and sort stores" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" className={chip(sort === "recommended")} aria-pressed={sort === "recommended"} onClick={() => setSort("recommended")}>
          Recommended
        </button>
        <button type="button" className={chip(sort === "nearest")} aria-pressed={sort === "nearest"} onClick={() => void nearMe()}>
          <HugeiconsIcon icon={Location01Icon} className="size-4" aria-hidden /> Near me
        </button>
        <button type="button" className={chip(sort === "rating")} aria-pressed={sort === "rating"} onClick={() => setSort("rating")}>
          Top rated
        </button>
        <button type="button" className={chip(fast)} aria-pressed={fast} onClick={() => setFast((f) => !f)}>
          Fast delivery
        </button>
        {area ? (
          <button type="button" className={chip(onlyArea)} aria-pressed={onlyArea} onClick={() => setOnlyArea((o) => !o)}>
            Only {area}
          </button>
        ) : null}
        <button type="button" className={chip(sort === "name")} aria-pressed={sort === "name"} onClick={() => setSort("name")}>
          A–Z
        </button>
      </div>

      {q.isError ? (
        <ErrorState title="Stores didn't load" error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </div>
      ) : shops.length === 0 ? (
        <EmptyState title="No shops match" description="Turn off a filter to see more shops." illustration="no-results" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <h2 className="sr-only">Shops</h2>
          {shops.map((s) => (
            <StoreCard key={s.slug} shop={s} distanceKm={distanceKm(pin, s)} />
          ))}
        </div>
      )}
    </div>
  )
}
