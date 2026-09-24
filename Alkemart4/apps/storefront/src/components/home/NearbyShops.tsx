import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { MapPin } from "@phosphor-icons/react"
import { listStoreVendors } from "@/lib/vendors"
import { distanceKm, formatDistance, readPin, sortByDistance } from "@/lib/nearby"
import { Container } from "@/components/shell/Container"
import { cn } from "@/lib/utils"

/**
 * Shops near the buyer, by real distance.
 *
 * Renders only when two things are true: the buyer has set a pin, and at least
 * one shop has coordinates. Otherwise there is no "near" to speak of, and a
 * section headed "Nearby" listing shops ordered by something else would be a
 * lie — so it collapses rather than pretending.
 *
 * Distance is computed in this browser. The pin never leaves it; shop
 * coordinates are already public on the shop page.
 */
export function NearbyShops({ limit = 6 }: { limit?: number }) {
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

  const { data } = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    enabled: Boolean(pin),
    staleTime: 5 * 60 * 1000,
  })

  const nearby = useMemo(() => {
    if (!pin) return []
    const pinned = (data ?? []).filter(
      (v) => typeof v.lat === "number" && typeof v.lng === "number",
    )
    return sortByDistance(pinned, pin).slice(0, limit)
  }, [data, pin, limit])

  if (!pin || nearby.length === 0) return null

  return (
    <section aria-labelledby="nearby-shops" className="py-8">
      <Container>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 id="nearby-shops" className="text-xl font-black text-foreground">
              Shops near you
            </h2>
            <p className="text-sm text-muted-foreground">
              Closest first, by distance from where you are.
            </p>
          </div>
          <Link to="/shops" className="shrink-0 text-sm font-bold hover:underline">
            All shops
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {nearby.map((shop) => {
            const away = formatDistance(distanceKm(pin, shop))
            return (
              <li key={shop.id}>
                <Link
                  to="/shops/$slug"
                  params={{ slug: shop.slug }}
                  className={cn(
                    "group flex h-full flex-col gap-1.5 rounded-xl border border-border/70 bg-background p-2.5",
                    "hover:border-primary/60 focus-visible:border-primary",
                  )}
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
                    {shop.logo ? (
                      <img
                        src={shop.logo}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl font-black text-muted-foreground/40">
                        {shop.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="truncate text-xs font-bold text-foreground">{shop.name}</span>
                  {away ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin size={11} weight="fill" aria-hidden />
                      {away}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
