import type { HomeSection } from "@alkemart/shared/homepage"
import { visibleSections } from "@alkemart/shared/homepage"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { MerchEmpty, MerchGridSection, MerchPromoBand, MerchPromoGrid, MerchPromoHero, MerchShelf, MerchValueGrid } from "@workspace/ui"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { IconSafe } from "@/design/icons"
import { iconForCategory, metaFor } from "@/lib/catalog-nav"
import { listStoreProducts, type StoreCategory, type StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"

type Props = { sections: HomeSection[]; categories: StoreCategory[]; products: StoreProductCard[] }

export function HomepageSections({ sections, categories, products }: Props) {
  const live = visibleSections(sections)
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  if (!live.length) return null
  return <div className="space-y-8 sm:space-y-10">{live.map((section) => {
    if (section.type === "promo_hero") return <MerchPromoHero key={section.id} {...section} layout={section.layout ?? "split"} />
    if (section.type === "promo_grid") return <MerchPromoGrid key={section.id} {...section} variant={section.variant ?? "cards"} />
    if (section.type === "promo_band") return <MerchPromoBand key={section.id} {...section} />
    if (section.type === "category_grid") {
      const configured = section.categoryIds.map((id) => categoryById.get(id)).filter((category): category is StoreCategory => Boolean(category))
      const fallback = categories.filter((category) => !category.parentCategoryId).slice(0, section.columns)
      return <CategoryGrid key={section.id} section={section} categories={configured.length ? configured : fallback} />
    }
    if (section.type === "product_shelf") {
      const shelfCategory = section.categoryId ? categoryById.get(section.categoryId) : undefined
      return <ManagedProductShelf key={section.id} section={section} category={shelfCategory} featured={products} />
    }
    return <MerchValueGrid key={section.id} title={section.title} subtitle={section.subtitle} items={section.items} />
  })}</div>
}

function CategoryGrid({ section, categories }: { section: Extract<HomeSection, { type: "category_grid" }>; categories: StoreCategory[] }) {
  const variant = section.variant ?? "tiles"
  const items = categories.slice(0, section.columns)
  if (!items.length) {
    return <MerchEmpty title={section.title} body={section.subtitle ?? "Categories will appear here once the catalogue is linked."} />
  }
  const action = section.showAllLink === false ? undefined : (
    <Link to="/categories/$slug" params={{ slug: "all" }} className="text-sm font-bold hover:underline">View all</Link>
  )
  return (
    <MerchGridSection title={section.title} subtitle={section.subtitle} columns={section.columns} variant={variant} action={action}>
      {items.map((category, index) => {
        const photo = metaFor(category.handle)?.mosaic?.photo
        const slug = category.handle || category.id
        const featured = variant === "mosaic" && index < 2
        return (
          <Link
            key={category.id}
            to="/categories/$slug"
            params={{ slug }}
            role={variant === "rail" ? "listitem" : undefined}
            className={cn(
              "group overflow-hidden rounded-2xl border border-black/10 bg-white",
              variant === "rail" && "w-36 shrink-0 snap-start sm:w-44",
            )}
          >
            <div className={cn("relative bg-[#f5f5f5]", featured ? "aspect-square sm:aspect-auto sm:h-full sm:min-h-72 lg:min-h-80" : "aspect-square")}>
              {photo ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <IconSafe name={iconForCategory(category.name, category.handle)} size={52} preferAsset className="absolute inset-0 m-auto" />}
            </div>
            <p className="truncate px-3 py-3 text-center text-sm font-bold">{category.name}</p>
          </Link>
        )
      })}
    </MerchGridSection>
  )
}

function ProductShelf({ title, subtitle, layout = "grid", products }: { title: string; subtitle?: string; layout?: "grid" | "carousel"; products: StoreProductCard[] }) {
  if (!products.length) return null
  if (layout === "carousel") {
    return <MerchShelf title={title} subtitle={subtitle} layout="carousel">{products.map((product) => <div key={product.id} className="w-44 shrink-0 snap-start sm:w-56"><ProductCard product={product} size="tile" /></div>)}</MerchShelf>
  }
  return <MerchShelf title={title} subtitle={subtitle}><ProductGridShell>{products.map((product) => <ProductCard key={product.id} product={product} size="tile" />)}</ProductGridShell></MerchShelf>
}

function ManagedProductShelf({ section, category, featured }: { section: Extract<HomeSection, { type: "product_shelf" }>; category?: StoreCategory; featured: StoreProductCard[] }) {
  const isManual = section.source === "manual"
  const liveQ = useQuery({
    queryKey: ["store", "homepage-shelf", section.source, category?.id ?? "all", section.limit],
    queryFn: () => listStoreProducts({ limit: section.limit, sort: "newest", ...(category ? { categoryId: category.id, categoryHandle: category.handle || undefined } : {}) }),
    enabled: (section.source === "latest" || section.source === "category") && (section.source !== "category" || Boolean(category)),
    staleTime: 120_000,
  })
  if (isManual) {
    const ids = section.productIds ?? []
    const byId = new Map(featured.map((product) => [product.id, product]))
    const manual = ids.map((id) => byId.get(id)).filter((product): product is StoreProductCard => Boolean(product))
    if (!manual.length) return <MerchEmpty title={section.title} body="This curated shelf has no matching live products yet. Link valid product IDs in Homepage Studio." />
    return <ProductShelf title={section.title} subtitle={section.subtitle} layout={section.layout ?? "grid"} products={manual.slice(0, section.limit)} />
  }
  const products = section.source === "featured" ? featured.slice(0, section.limit) : (liveQ.data?.products ?? [])
  if (liveQ.isLoading) return <section className="space-y-4"><h2 className="type-section">{section.title}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: Math.min(section.limit, 4) }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-black/5" />)}</div></section>
  if (section.source === "category" && !category) return <MerchEmpty title={section.title} body="The linked category is no longer in the catalogue. Pick another category in Homepage Studio." />
  return <ProductShelf title={section.title} subtitle={section.subtitle} layout={section.layout ?? "grid"} products={products} />
}
