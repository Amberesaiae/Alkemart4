import { useCallback, useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import type { HomeSection } from "@alkemart/shared/homepage"
import { MerchEmpty, MerchSectionHeader } from "@workspace/ui"
import { ProductCard } from "@/components/product-card"
import { PRODUCT_GRID_CLASS } from "@/components/product-grid"
import { DealTabsSkeleton, ProductCardSkeleton } from "@/components/skeleton"
import { IconSafe } from "@/design/icons"
import { resolveRailCategories, type RailCategory } from "@/lib/catalog-nav"
import type { StoreCategory, StoreProductCard } from "@/lib/products"
import { useShelfSource } from "@/components/home/useShelfSource"
import type { ClaimProducts } from "@/components/home/HomepageSections"
import { cn } from "@/lib/utils"

type Props = {
  section: Extract<HomeSection, { type: "deal_rail" }>
  category?: StoreCategory
  categories: StoreCategory[]
  featured: StoreProductCard[]
  featuredLoading?: boolean
  /** Takes only products no beat above has rendered. */
  claim?: ClaimProducts
}

/**
 * Deals of the day — the hub shape, not a rail.
 *
 * A department tab strip sits over a grid of deal cards, and the grid always
 * keeps one campaign tile inside it rather than stacking another banner above
 * the merchandise. The tabs are *filters over one fetch*, not four separate
 * shelves: switching a tab cannot show a product the section did not already
 * resolve, and it never refetches, so tab switching is instant.
 *
 * A tab with no deals behind it is not rendered. A dead tab is a promise the
 * catalogue cannot keep, and buyers read it as "this shop has nothing".
 */
export function DealsOfTheDay({ section, category, categories, featured, featuredLoading, claim }: Props) {
  const [activeHandle, setActiveHandle] = useState<string | null>(null)

  // Over-fetch so tab filtering has something to filter. The section still
  // renders `limit` cards at a time.
  const resolved = useShelfSource({
    source: section.source,
    limit: Math.max(section.limit * 3, 24),
    category,
    categories,
    featured,
    featuredLoading,
    productIds: section.productIds,
    scope: `deals:${section.id}`,
  })

  const departments = useMemo(() => resolveRailCategories(categories), [categories])

  /** department handle → every handle that belongs under it (itself + children). */
  const handleGroups = useMemo(() => {
    const groups = new Map<string, Set<string>>()
    for (const dept of departments) {
      const handle = (dept.handle || dept.id).toLowerCase()
      const set = new Set<string>([handle, dept.id.toLowerCase()])
      for (const child of dept.children) set.add(child.handle.toLowerCase())
      for (const cat of categories) {
        if (cat.parentCategoryId && cat.parentCategoryId === dept.id && cat.handle) {
          set.add(cat.handle.toLowerCase())
        }
      }
      groups.set(handle, set)
    }
    return groups
  }, [departments, categories])

  const deals = resolved.products

  const matches = useCallback(
    (product: StoreProductCard, handle: string) => {
      const group = handleGroups.get(handle)
      if (!group) return false
      return (product.categoryHandles ?? []).some((h) => group.has(h.toLowerCase()))
    },
    [handleGroups],
  )

  /** Tabs that actually have deals behind them, keeping the department order. */
  const tabs = useMemo(() => {
    if (!deals.length) return []
    return departments
      .map((dept) => {
        const handle = (dept.handle || dept.id).toLowerCase()
        return { dept, handle, count: deals.filter((p) => matches(p, handle)).length }
      })
      .filter((tab) => tab.count > 0)
  }, [departments, deals, matches])

  const active = activeHandle && tabs.some((t) => t.handle === activeHandle) ? activeHandle : null
  const shown = active ? deals.filter((p) => matches(p, active)) : deals

  // Prefer cards no beat above has shown. On a young catalogue every source
  // overlaps, and a deals beat that vanished entirely would gut the page's
  // rhythm — so when too few fresh cards remain, the hub falls back to its
  // own slice. Repetition under a different lens (price, urgency) is how
  // every reference marketplace survives a small catalogue.
  const fresh = claim ? claim(shown, section.limit) : []
  const unclaimed = fresh.length >= 3 ? fresh : shown.slice(0, section.limit)

  const action = section.showAllLink === false ? undefined : (
    <Link to="/categories/$slug" params={{ slug: active ?? "all" }} className="text-sm font-bold hover:underline">
      View more
    </Link>
  )

  if (resolved.loading) {
    return (
      <section className="space-y-4" aria-label={`Loading ${section.title}`}>
        <MerchSectionHeader eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} />
        <DealTabsSkeleton />
        <div className={PRODUCT_GRID_CLASS}>
          {Array.from({ length: Math.min(section.limit, 8) }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (!deals.length) {
    return (
      <MerchEmpty
        title={section.title}
        body={resolved.emptyReason ?? "No live products match this deal yet."}
      />
    )
  }

  // One campaign tile rides inside the grid — the third slot, where the eye
  // has already seen two prices and is ready for a break. Ink, not gold: the
  // page's gold budget is already spent on the header CTA, and two gold blocks
  // in one screen read as decoration rather than emphasis.
  const promo = section.promoTile
  const promoTile = promo ? (
    <Link
      key={promo.id}
      to={promo.href}
      className="group flex min-h-[180px] flex-col justify-between gap-3 rounded-xl bg-ink p-4 text-white shadow-xs transition-transform duration-200 hover:-translate-y-0.5 sm:p-5"
    >
      <span className="min-w-0">
        {promo.eyebrow ? (
          <span className="block text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {promo.eyebrow}
          </span>
        ) : null}
        <span className="mt-1 block text-lg font-bold leading-tight sm:text-xl">
          {promo.title}
        </span>
        {promo.body ? (
          <span className="mt-1.5 block text-xs font-medium leading-snug opacity-70 sm:text-sm">
            {promo.body}
          </span>
        ) : null}
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary underline-offset-2 group-hover:underline">
        Shop now →
      </span>
    </Link>
  ) : null

  const cards: React.ReactNode[] = []
  unclaimed.forEach((product, index) => {
    cards.push(<ProductCard key={product.id} product={product} size="store" />)
    if (promoTile && index === 1) cards.push(promoTile)
  })
  if (promoTile && !cards.includes(promoTile)) cards.push(promoTile)

  // Fewer than three real deals cannot hold the grid; collapse rather than
  // pad the beat with whatever is left.
  if (unclaimed.length < 3) return null

  return (
    <section className="space-y-4" aria-label={section.title}>
      <MerchSectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        action={action}
      />

      {tabs.length > 1 ? (
        <div
          role="tablist"
          aria-label="Deal departments"
          className="scrollbar-none flex gap-2 overflow-x-auto border-b border-black/[0.06] pb-px"
        >
          <DealTab
            label="All"
            icon="cat-all"
            count={deals.length}
            active={active === null}
            onClick={() => setActiveHandle(null)}
          />
          {tabs.map((tab) => (
            <DealTab
              key={tab.handle}
              label={tab.dept.name}
              icon={tab.dept.icon}
              count={tab.count}
              active={active === tab.handle}
              onClick={() => setActiveHandle(tab.handle)}
            />
          ))}
        </div>
      ) : null}

      <div className={PRODUCT_GRID_CLASS}>{cards}</div>
    </section>
  )
}

function DealTab({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string
  icon: RailCategory["icon"]
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-bold transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <IconSafe name={icon} size={18} preferAsset />
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className={cn("text-xs font-semibold", active ? "text-muted-foreground" : "text-muted-foreground/70")}>
          {count}
        </span>
      ) : null}
    </button>
  )
}
