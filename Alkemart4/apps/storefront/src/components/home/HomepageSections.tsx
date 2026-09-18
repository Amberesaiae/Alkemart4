import type { CategoryBannerTile, HomeSection } from "@alkemart/shared/homepage"
import { categoryRatioOf, categoryTilesOf, visibleSections } from "@alkemart/shared/homepage"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { MerchCategoryTileBody, MerchCountdownBanner, MerchDealBadge, MerchDealRail, MerchEmpty, MerchGridSection, MerchMarquee, MerchPromoBand, MerchPromoGrid, MerchPromoHero, MerchShelf, MerchValueGrid, merchCategoryTileClass } from "@workspace/ui"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { IconSafe } from "@/design/icons"
import { iconForCategory, metaFor } from "@/lib/catalog-nav"
import { listStoreProducts, type StoreCategory, type StoreProductCard } from "@/lib/products"
import { useShelfSource } from "@/components/home/useShelfSource"
import { StoreRail } from "@/components/home/StoreRail"

type Props = { sections: HomeSection[]; categories: StoreCategory[]; products: StoreProductCard[] }

export function HomepageSections({ sections, categories, products }: Props) {
  const live = visibleSections(sections)
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  if (!live.length) return null
  return <div className="space-y-8 sm:space-y-10">{live.map((section) => {
    if (section.type === "promo_hero") return <MerchPromoHero key={section.id} {...section} layout={section.layout ?? "split"} />
    if (section.type === "promo_grid") return <MerchPromoGrid key={section.id} {...section} variant={section.variant ?? "cards"} />
    if (section.type === "promo_band") return <MerchPromoBand key={section.id} {...section} />
    if (section.type === "countdown_banner") return <MerchCountdownBanner key={section.id} {...section} />
    if (section.type === "marquee") return <MerchMarquee key={section.id} {...section} />
    if (section.type === "deal_rail") {
      const dealCategory = section.categoryId ? categoryById.get(section.categoryId) : undefined
      return <DealRail key={section.id} section={section} category={dealCategory} featured={products} />
    }
    if (section.type === "category_grid") return <CategoryBanners key={section.id} section={section} categoryById={categoryById} categories={categories} />
    if (section.type === "product_shelf") {
      const shelfCategory = section.categoryId ? categoryById.get(section.categoryId) : undefined
      return <ManagedProductShelf key={section.id} section={section} category={shelfCategory} categories={categories} featured={products} />
    }
    if (section.type === "store_rail") return <StoreRail key={section.id} section={section} />
    return <MerchValueGrid key={section.id} title={section.title} subtitle={section.subtitle} items={section.items} />
  })}</div>
}

/**
 * Category banners — the studio-driven successor to the hand-built mosaic.
 *
 * Each tile is a banner: admin-chosen art (falling back to the canonical
 * category photography), an optional crop, and a caption below the image.
 * Layout and proportions come from the section, so the same component covers
 * the mosaic hierarchy, an even tile grid, a scroll rail, and wide strips.
 */
function CategoryBanners({ section, categoryById, categories }: {
  section: Extract<HomeSection, { type: "category_grid" }>
  categoryById: Map<string, StoreCategory>
  categories: StoreCategory[]
}) {
  const variant = section.variant ?? "tiles"
  const ratio = categoryRatioOf(section)
  type ResolvedTile = { tile: CategoryBannerTile; category: StoreCategory }
  const configured: ResolvedTile[] = categoryTilesOf(section)
    .map((tile) => ({ tile, category: categoryById.get(tile.categoryId) }))
    .filter((entry): entry is ResolvedTile => Boolean(entry.category))

  // Nothing configured yet: show real top-level departments rather than a hole.
  const entries: ResolvedTile[] = configured.length
    ? configured
    : categories
        .filter((category) => !category.parentCategoryId)
        .slice(0, variant === "mosaic" ? 4 : section.columns)
        .map((category, index) => ({
          tile: { categoryId: category.id, slot: index < 2 ? ("feature" as const) : ("standard" as const) },
          category,
        }))

  const limit = variant === "mosaic" ? 4 : 16
  const shown = entries.slice(0, limit)

  if (!shown.length) {
    return <MerchEmpty title={section.title} body={section.subtitle ?? "Categories will appear here once the catalogue is linked."} />
  }

  const action = section.showAllLink === false ? undefined : (
    <Link to="/categories/$slug" params={{ slug: "all" }} className="text-sm font-bold hover:underline">View all</Link>
  )

  return (
    <MerchGridSection title={section.title} subtitle={section.subtitle} columns={section.columns} variant={variant} action={action}>
      {shown.map(({ tile, category }, index) => {
        // Mosaic keeps its two-large / two-small composition even when an
        // admin has not marked slots, matching the original homepage design.
        const feature = tile.slot ? tile.slot === "feature" : variant === "mosaic" && index < 2
        const label = tile.label || category.name
        const photo = tile.imageUrl || metaFor(category.handle)?.mosaic?.photo
        return (
          <Link
            key={`${section.id}-${category.id}`}
            to="/categories/$slug"
            params={{ slug: category.handle || category.id }}
            aria-label={`Browse ${label}`}
            role={variant === "rail" ? "listitem" : undefined}
            className={merchCategoryTileClass({ variant, ratio, feature })}
          >
            <MerchCategoryTileBody
              label={label}
              badge={tile.badge}
              imageUrl={photo}
              focalPoint={tile.focalPoint}
              imageClassName={metaFor(category.handle)?.mosaic?.objectPos}
              feature={feature}
              variant={variant}
              ratio={ratio}
              fallback={<IconSafe name={iconForCategory(category.name, category.handle)} size={feature ? 64 : 44} preferAsset />}
            />
          </Link>
        )
      })}
    </MerchGridSection>
  )
}

/**
 * Deal rail — campaign framing around real products.
 *
 * Deliberately shows no "% off" or stock meter: the catalogue carries no
 * compare-at price or inventory count, and inventing either would be a claim
 * we cannot substantiate. The urgency comes from the admin's badge and clock,
 * both of which are real.
 */
function DealRail({ section, category, featured }: {
  section: Extract<HomeSection, { type: "deal_rail" }>
  category?: StoreCategory
  featured: StoreProductCard[]
}) {
  const liveQ = useQuery({
    queryKey: ["store", "homepage-deals", section.source, category?.id ?? "all", section.limit],
    queryFn: () => listStoreProducts({ limit: section.limit, sort: "newest", ...(category ? { categoryId: category.id, categoryHandle: category.handle || undefined } : {}) }),
    enabled: (section.source === "latest" || section.source === "category") && (section.source !== "category" || Boolean(category)),
    staleTime: 120_000,
  })

  let products: StoreProductCard[] = []
  if (section.source === "manual") {
    const byId = new Map(featured.map((product) => [product.id, product]))
    products = (section.productIds ?? []).map((id) => byId.get(id)).filter((product): product is StoreProductCard => Boolean(product))
  } else if (section.source === "featured") {
    products = featured.slice(0, section.limit)
  } else {
    products = liveQ.data?.products ?? []
  }

  if (section.source === "category" && !category) {
    return <MerchEmpty title={section.title} body="The linked category is no longer in the catalogue. Pick another category in Homepage Studio." />
  }
  if (!products.length) {
    if (liveQ.isLoading) {
      return (
        <MerchDealRail title={section.title} subtitle={section.subtitle} eyebrow={section.eyebrow} countdownTo={section.countdownTo}>
          {Array.from({ length: Math.min(section.limit, 4) }).map((_, index) => (
            <div key={index} className="aspect-[3/4] w-44 shrink-0 animate-pulse rounded-xl bg-black/5 sm:w-56" />
          ))}
        </MerchDealRail>
      )
    }
    return <MerchEmpty title={section.title} body="No live products match this deal yet." />
  }

  return (
    <MerchDealRail title={section.title} subtitle={section.subtitle} eyebrow={section.eyebrow} countdownTo={section.countdownTo}>
      {products.slice(0, section.limit).map((product) => (
        <div key={product.id} className="relative w-44 shrink-0 snap-start sm:w-56">
          {section.badge ? <MerchDealBadge label={section.badge} /> : null}
          <ProductCard product={product} size="tile" />
        </div>
      ))}
    </MerchDealRail>
  )
}

function ProductShelf({ title, subtitle, layout = "grid", products }: { title: string; subtitle?: string; layout?: "grid" | "carousel"; products: StoreProductCard[] }) {
  if (!products.length) return null
  if (layout === "carousel") {
    return <MerchShelf title={title} subtitle={subtitle} layout="carousel">{products.map((product) => <div key={product.id} className="w-44 shrink-0 snap-start sm:w-56"><ProductCard product={product} size="tile" /></div>)}</MerchShelf>
  }
  return <MerchShelf title={title} subtitle={subtitle}><ProductGridShell>{products.map((product) => <ProductCard key={product.id} product={product} size="tile" />)}</ProductGridShell></MerchShelf>
}

function ManagedProductShelf({ section, category, categories, featured }: { section: Extract<HomeSection, { type: "product_shelf" }>; category?: StoreCategory; categories?: StoreCategory[]; featured: StoreProductCard[] }) {
  const resolved = useShelfSource({
    source: section.source,
    limit: section.limit,
    category,
    categories,
    featured,
    productIds: section.productIds,
    daypartCategoryIds: section.daypartCategoryIds,
    scope: `shelf:${section.id}`,
  })

  // A daypart shelf names itself from the buyer's clock, so the configured
  // title is a fallback rather than the heading.
  const title = resolved.titleOverride ?? section.title

  if (resolved.loading) {
    return (
      <section className="space-y-4">
        <h2 className="type-section">{title}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: Math.min(section.limit, 4) }).map((_, index) => (
            <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-black/5" />
          ))}
        </div>
      </section>
    )
  }
  if (section.source === "category" && !category) {
    return <MerchEmpty title={title} body="The linked category is no longer in the catalogue. Pick another category in Homepage Studio." />
  }
  if (!resolved.products.length) {
    // A rule that resolved to nothing says so; it never backfills with an
    // unrelated slice of the catalogue dressed up as the thing it promised.
    return <MerchEmpty title={title} body={resolved.emptyReason ?? "No live products match this shelf yet."} />
  }
  return <ProductShelf title={title} subtitle={section.subtitle} layout={section.layout ?? "grid"} products={resolved.products} />
}
