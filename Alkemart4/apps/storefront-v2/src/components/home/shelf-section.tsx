import type { HomeSection } from "@alkemart/shared/homepage"
import { countdownParts, timeRemaining } from "@alkemart/shared/homepage"
import { useEffect, useState } from "react"
import { ProductGrid, ProductRail } from "@/components/commerce/product-grid"
import { SectionHeader } from "@/components/commerce/section-header"
import { useShelf } from "@/hooks/use-shelf"
import type { StoreCategory, StoreProductCard } from "@/lib/products"

type ShelfSection = Extract<HomeSection, { type: "product_shelf" | "deal_rail" }>

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const ms = timeRemaining(to, now)
  if (ms == null || ms <= 0) return null
  const p = countdownParts(ms)
  const cells = [
    ...(p.days ? [[p.days, "d"] as const] : []),
    [p.hours, "h"] as const,
    [p.minutes, "m"] as const,
    [p.seconds, "s"] as const,
  ]
  return (
    <span className="inline-flex items-center gap-1 tabular" aria-label="Time left">
      {cells.map(([v, u]) => (
        <span key={u} className="rounded-lg bg-foreground px-1.5 py-1 text-xs font-bold text-background">
          {String(v).padStart(2, "0")}
          {u}
        </span>
      ))}
    </span>
  )
}

/**
 * A managed product shelf / deal rail. Resolves its source to real products;
 * an empty resolution hides the section rather than showing filler.
 */
export function ShelfSection({
  section,
  categories,
  featured,
  featuredLoading,
}: {
  section: ShelfSection
  categories: StoreCategory[]
  featured: StoreProductCard[]
  featuredLoading: boolean
}) {
  const r = useShelf({
    source: section.source,
    limit: section.limit,
    categoryId: section.categoryId,
    categories,
    featured,
    featuredLoading,
    productIds: section.productIds,
    daypartCategoryIds: section.type === "product_shelf" ? section.daypartCategoryIds : undefined,
  })
  const products = r.products
  if (!r.loading && products.length === 0) return null

  const category = section.categoryId
    ? categories.find((c) => c.id === section.categoryId || c.handle === section.categoryId)
    : undefined
  const action = section.showAllLink
    ? category
      ? { label: "See all", to: "/categories/$slug" as const, params: { slug: category.handle ?? category.id } }
      : { label: "See all", to: "/categories/$slug" as const, params: { slug: "all" } }
    : undefined
  const grid = section.type === "product_shelf" && section.layout === "grid"
  const eyebrow = section.type === "deal_rail" ? section.eyebrow : undefined

  return (
    <section className="container-page" aria-label={r.titleOverride ?? section.title}>
      <SectionHeader
        eyebrow={eyebrow}
        title={r.titleOverride ?? section.title}
        subtitle={section.subtitle}
        action={action}
      >
        {section.type === "deal_rail" && section.countdownTo ? <Countdown to={section.countdownTo} /> : null}
      </SectionHeader>
      {grid ? (
        <ProductGrid products={products} loading={r.loading} skeletons={section.limit} />
      ) : (
        <ProductRail products={products} loading={r.loading} label={section.title} />
      )}
    </section>
  )
}
