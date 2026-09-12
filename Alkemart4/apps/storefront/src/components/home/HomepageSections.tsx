import type { HomeSection } from "@alkemart/shared/homepage"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { MerchGridSection, MerchPromoGrid, MerchPromoHero, MerchShelf, MerchValueGrid } from "@workspace/ui"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { IconSafe } from "@/design/icons"
import { iconForCategory, metaFor } from "@/lib/catalog-nav"
import { listStoreProducts, type StoreCategory, type StoreProductCard } from "@/lib/products"

type Props = { sections: HomeSection[]; categories: StoreCategory[]; products: StoreProductCard[] }

export function HomepageSections({ sections, categories, products }: Props) {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  return <div className="space-y-8 sm:space-y-10">{sections.map((section) => {
    if (section.type === "promo_hero") return <MerchPromoHero key={section.id} {...section} />
    if (section.type === "promo_grid") return <MerchPromoGrid key={section.id} {...section} />
    if (section.type === "category_grid") {
      const configured = section.categoryIds.map((id) => categoryById.get(id)).filter((category): category is StoreCategory => Boolean(category))
      return <CategoryGrid key={section.id} section={section} categories={configured.length ? configured : categories.filter((category) => !category.parentCategoryId).slice(0, section.columns)} />
    }
    if (section.type === "product_shelf") {
      const shelfCategory = section.categoryId ? categoryById.get(section.categoryId) : undefined
      return <ManagedProductShelf key={section.id} section={section} category={shelfCategory} featured={products} />
    }
    return <MerchValueGrid key={section.id} title={section.title} items={section.items} />
  })}</div>
}

function CategoryGrid({ section, categories }: { section: Extract<HomeSection, { type: "category_grid" }>; categories: StoreCategory[] }) {
  return <MerchGridSection title={section.title} columns={section.columns} action={<Link to="/categories/$slug" params={{ slug: "all" }} className="text-sm font-bold hover:underline">View all</Link>}>{categories.slice(0, section.columns).map((category) => { const photo = metaFor(category.handle)?.mosaic?.photo; const slug = category.handle || category.id; return <Link key={category.id} to="/categories/$slug" params={{ slug }} className="group overflow-hidden rounded-2xl border border-black/10 bg-white"><div className="relative aspect-square bg-[#f5f5f5]">{photo ? <img src={photo} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <IconSafe name={iconForCategory(category.name, category.handle)} size={52} preferAsset className="absolute inset-0 m-auto" />}</div><p className="truncate px-3 py-3 text-center text-sm font-bold">{category.name}</p></Link> })}</MerchGridSection>
}

function ProductShelf({ title, products }: { title: string; products: StoreProductCard[] }) { if (!products.length) return null; return <MerchShelf title={title}><ProductGridShell>{products.map((product) => <ProductCard key={product.id} product={product} size="tile" />)}</ProductGridShell></MerchShelf> }

function ManagedProductShelf({ section, category, featured }: { section: Extract<HomeSection, { type: "product_shelf" }>; category?: StoreCategory; featured: StoreProductCard[] }) {
  const liveQ = useQuery({
    queryKey: ["store", "homepage-shelf", section.source, category?.id ?? "all", section.limit],
    queryFn: () => listStoreProducts({ limit: section.limit, sort: "newest", ...(category ? { categoryId: category.id, categoryHandle: category.handle || undefined } : {}) }),
    enabled: section.source !== "featured" && (section.source !== "category" || Boolean(category)),
    staleTime: 120_000,
  })
  const products = section.source === "featured" ? featured.slice(0, section.limit) : (liveQ.data?.products ?? [])
  if (liveQ.isLoading) return <section className="space-y-4"><h2 className="type-section">{section.title}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: Math.min(section.limit, 4) }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-black/5" />)}</div></section>
  return <ProductShelf title={section.title} products={products} />
}
