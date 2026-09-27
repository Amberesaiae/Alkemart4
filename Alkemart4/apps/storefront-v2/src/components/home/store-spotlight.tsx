import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { formatMoney } from "@/lib/market"
import { listStoreVendors } from "@/lib/vendors"

/**
 * House ad for one real shop: its name, line and three of its own products.
 * Picked by rule (featured products, then rating, then sales) — the label
 * says "Store spotlight", never "sponsored". Backdrop art is a generated
 * image slot (/images/promos/spotlight.webp); the shop banner wins if it has one.
 */
export function StoreSpotlight() {
  const q = useQuery({ queryKey: ["store", "vendors"], queryFn: listStoreVendors, staleTime: 300_000 })
  const shop = (q.data ?? [])
    .filter((v) => v.availability !== "paused" && (v.featured?.length ?? 0) >= 2)
    .sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) || (b.salesCount ?? 0) - (a.salesCount ?? 0))[0]
  if (!shop) return null
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
          <div className="flex items-center gap-3">
            <SellerAvatar name={shop.name} logo={shop.logo} size="lg" className="ring-white/20" />
            <h2 className="text-3xl font-extrabold sm:text-4xl">{shop.name}</h2>
          </div>
          {shop.tagline || shop.bio ? <p className="max-w-md text-white/75">{shop.tagline ?? shop.bio}</p> : null}
          <Button asChild variant="brand" size="xl">
            <Link to="/shops/$slug" params={{ slug: shop.slug }}>
              Shop now <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Link>
          </Button>
        </div>
        <ul className="grid grid-cols-3 gap-3">
          {(shop.featured ?? []).slice(0, 3).map((f) => (
            <li key={f.productId}>
              <Link to="/product/$id" params={{ id: f.productId }} className="block overflow-hidden rounded-2xl bg-white text-foreground">
                <span className="block aspect-square bg-surface">
                  {f.imageUrl ? <img src={f.imageUrl} alt={f.title} loading="lazy" className="size-full object-contain p-3 mix-blend-multiply" /> : null}
                </span>
                <span className="block truncate px-3 pt-2 text-xs font-medium">{f.title}</span>
                <span className="block px-3 pb-3 text-sm font-bold tabular">
                  {formatMoney(Number(f.fromPricePesewas) / 100, null, { compact: true })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
