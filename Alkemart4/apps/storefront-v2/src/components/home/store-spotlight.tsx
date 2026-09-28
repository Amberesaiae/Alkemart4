import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Location01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import type { HomeSpotlight } from "@/components/home/discovery"
import { formatMoney } from "@/lib/market"

/**
 * Shop story: one real shop a week, taking turns among open shops with a
 * cover (picked in useHomeDiscovery). Its name, region, own description and up
 * to three listings not already on the page. Labelled "Store spotlight",
 * never "sponsored"; nobody pays for the turn.
 */
export function StoreSpotlight({ spotlight }: { spotlight: HomeSpotlight | null }) {
  if (!spotlight) return null
  const { shop, line, products } = spotlight
  return (
    <section className="container-page" aria-label={`Store spotlight: ${shop.name}`}>
      <div className="relative isolate grid gap-6 overflow-hidden rounded-[2rem] bg-ink on-ink p-6 text-white sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <img
          src={shop.banner ?? "/images/promos/spotlight.webp"}
          alt=""
          aria-hidden
          loading="lazy"
          onError={(e) => e.currentTarget.remove()}
          className="absolute inset-0 -z-10 size-full object-cover opacity-35"
        />
        <div className="space-y-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Store spotlight</p>
          <h2 className="text-3xl font-extrabold sm:text-4xl">{shop.name}</h2>
          {shop.location ? (
            <p className="flex items-center gap-1.5 text-sm text-white/70">
              <HugeiconsIcon icon={Location01Icon} className="size-4" aria-hidden /> {shop.location}
            </p>
          ) : null}
          {line ? <p className="max-w-md text-white/80">{line}</p> : null}
          <Button asChild variant="brand" size="xl">
            <Link to="/shops/$slug" params={{ slug: shop.slug }}>
              Shop now <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        {products.length ? (
          <ul className="grid grid-cols-3 gap-3">
            {products.map((p) => (
              <li key={p.id}>
                <Link to="/product/$id" params={{ id: p.id }} className="block overflow-hidden rounded-2xl bg-white text-foreground">
                  <span className="block aspect-square bg-surface">
                    {p.thumbUrl ?? p.thumbnail ? <img src={p.thumbUrl ?? p.thumbnail ?? undefined} alt={p.title} loading="lazy" className="size-full object-cover" /> : null}
                  </span>
                  <span className="block truncate px-3 pt-2 text-xs font-medium">{p.title}</span>
                  <span className="block px-3 pb-3 text-sm font-bold tabular">{formatMoney(p.amount, p.currencyCode, { compact: true })}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
