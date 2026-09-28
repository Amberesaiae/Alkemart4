import { Link } from "@tanstack/react-router"
import { SectionHeader } from "@/components/commerce/section-header"
import { ProductCard } from "@/components/commerce/product-card"
import type { HomeSpotlight } from "@/components/home/discovery"

/**
 * Shop of the week: one real shop, taking turns weekly among open shops with a
 * cover (picked in useHomeDiscovery). Laid out like every other row: a plain
 * section header, the shop's own cover photo undimmed, its facts, and four of
 * its listings as ordinary product cards. Nobody pays for the turn.
 */
export function StoreSpotlight({ spotlight }: { spotlight: HomeSpotlight | null }) {
  if (!spotlight || spotlight.products.length === 0) return null
  const { shop, line, products } = spotlight
  const facts = [shop.location, shop.salesCount ? `${shop.salesCount} order${shop.salesCount === 1 ? "" : "s"} fulfilled` : null].filter(Boolean)
  return (
    <section className="container-page" aria-label={`Shop of the week: ${shop.name}`}>
      <SectionHeader title="Shop of the week" action={{ label: "Visit shop", to: "/shops/$slug", params: { slug: shop.slug } }} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        <Link to="/shops/$slug" params={{ slug: shop.slug }} className="group block">
          {shop.banner ? (
            <img
              src={shop.banner}
              alt={`Inside ${shop.name}`}
              loading="lazy"
              className="aspect-[16/10] w-full rounded-2xl object-cover"
            />
          ) : null}
          <h3 className="mt-4 text-xl font-bold group-hover:underline">{shop.name}</h3>
          {facts.length ? <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p> : null}
          {line ? <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{line}</p> : null}
        </Link>
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-2">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  )
}
