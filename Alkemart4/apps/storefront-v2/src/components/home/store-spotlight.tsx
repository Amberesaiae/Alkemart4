import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Location01Icon } from "@hugeicons/core-free-icons"
import { rotationPick } from "@alkemart/shared/homepage"
import { Button } from "@/components/ui/button"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { formatMoney } from "@/lib/market"
import { listStoreProducts } from "@/lib/products"
import { getStoreVendorBySlug, listStoreVendors } from "@/lib/vendors"

/**
 * Shop story: one real shop a week, taking turns among open shops that have
 * a cover photo. Its own description, region and first three listings — the
 * label says "Store spotlight", never "sponsored". Rotation is by calendar
 * week, so every eligible shop gets its turn and nobody pays for placement.
 */
export function StoreSpotlight() {
  const vendorsQ = useQuery({ queryKey: ["store", "vendors"], queryFn: listStoreVendors, staleTime: 300_000 })
  const eligible = (vendorsQ.data ?? [])
    .filter((v) => v.availability !== "paused" && Boolean(v.banner))
    .sort((a, b) => a.slug.localeCompare(b.slug))
  const pick = rotationPick(eligible, 1, new Date(), 7)[0]
  const detailQ = useQuery({
    queryKey: ["store", "vendor", pick?.slug],
    queryFn: () => getStoreVendorBySlug(pick!.slug),
    enabled: Boolean(pick),
    staleTime: 300_000,
  })
  const productsQ = useQuery({
    queryKey: ["store", "spotlight", "products", pick?.slug],
    queryFn: () => listStoreProducts({ sellerHandle: pick!.slug, limit: 3 }),
    enabled: Boolean(pick),
    staleTime: 300_000,
  })
  const shop = pick
  const products = productsQ.data?.products ?? []
  if (!shop || products.length === 0) return null
  const line = detailQ.data?.vendor.bio ?? shop.tagline ?? shop.bio
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
        <ul className="grid grid-cols-3 gap-3">
          {products.map((p) => (
            <li key={p.id}>
              <Link to="/product/$id" params={{ id: p.id }} className="block overflow-hidden rounded-2xl bg-white text-foreground">
                <span className="block aspect-square bg-surface">
                  {p.thumbUrl ?? p.thumbnail ? <img src={p.thumbUrl ?? p.thumbnail ?? undefined} alt={p.title} loading="lazy" className="size-full object-cover" /> : null}
                </span>
                <span className="block truncate px-3 pt-2 text-xs font-medium">{p.title}</span>
                <span className="block px-3 pb-3 text-sm font-bold tabular">
                  {formatMoney(p.amount, p.currencyCode, { compact: true })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
