import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { rotationPick } from "@alkemart/shared/homepage"
import { ProductGrid, ProductRail } from "@/components/commerce/product-grid"
import { SectionHeader } from "@/components/commerce/section-header"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/market"
import { listStoreProducts, type StoreCategory, type StoreProductCard } from "@/lib/products"

/**
 * Homepage discovery rows. Every row resolves from real listings or renders
 * nothing: a row with fewer than MIN_ROW products is hidden rather than
 * padded with unrelated items.
 */
const MIN_ROW = 4
const ROW_MAX = 12
/** One newest-first page feeds the department and price rows (API max 100). */
const DISCOVERY_PAGE = 96
const EXPLORE_PAGE = 24

function useDiscoveryCatalog() {
  return useQuery({
    queryKey: ["store", "discovery", "catalog"],
    queryFn: () => listStoreProducts({ limit: DISCOVERY_PAGE, sort: "newest" }),
    staleTime: 300_000,
  })
}

/** The top-level department a product's category sits under. */
export function departmentOf(product: StoreProductCard, categories: StoreCategory[]): StoreCategory | undefined {
  const byKey = new Map<string, StoreCategory>()
  for (const c of categories) {
    byKey.set(c.id, c)
    if (c.handle) byKey.set(c.handle, c)
  }
  let node = byKey.get(product.categoryHandles?.[0] ?? "")
  for (let hops = 0; node?.parentCategoryId && hops < 8; hops++) node = byKey.get(node.parentCategoryId) ?? node
  return node
}

/** Departments with enough listings for a full row, in department order. */
export function departmentRows(products: StoreProductCard[], categories: StoreCategory[]) {
  const groups = new Map<string, { department: StoreCategory; products: StoreProductCard[] }>()
  for (const p of products) {
    const d = departmentOf(p, categories)
    if (!d) continue
    const g = groups.get(d.id) ?? { department: d, products: [] }
    g.products.push(p)
    groups.set(d.id, g)
  }
  return [...groups.values()]
    .filter((g) => g.products.length >= MIN_ROW)
    .sort((a, b) => (a.department.rank ?? 0) - (b.department.rank ?? 0) || a.department.name.localeCompare(b.department.name))
}

/** Listings at or under a price, cheapest first, optionally within one department. */
export function priceRow(products: StoreProductCard[], categories: StoreCategory[], maxAmount: number, department?: string) {
  return products
    .filter((p) => p.amount != null && p.amount <= maxAmount)
    .filter((p) => !department || departmentOf(p, categories)?.handle === department)
    .sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))
    .slice(0, ROW_MAX)
}

function Row({ title, eyebrow, subtitle, products, loading, action }: {
  title: string
  eyebrow?: string
  subtitle?: string
  products: StoreProductCard[]
  loading?: boolean
  action?: Parameters<typeof SectionHeader>[0]["action"]
}) {
  if (!loading && products.length < MIN_ROW) return null
  return (
    <section className="container-page" aria-label={title}>
      <SectionHeader title={title} eyebrow={eyebrow} subtitle={subtitle} action={action} />
      <ProductRail products={products} loading={loading} label={title} />
    </section>
  )
}

/** Two departments a day, taking turns, each linking to its category page. */
export function DepartmentSpotlight({ categories }: { categories: StoreCategory[] }) {
  const q = useDiscoveryCatalog()
  if (!categories.length) return null
  const today = rotationPick(departmentRows(q.data?.products ?? [], categories), 2, new Date(), 1)
  return (
    <>
      {today.map(({ department, products }) => (
        <Row
          key={department.id}
          eyebrow="Department of the day"
          title={department.name}
          products={products.slice(0, ROW_MAX)}
          action={{ label: "See all", to: "/categories/$slug", params: { slug: department.handle ?? department.id } }}
        />
      ))}
    </>
  )
}

/** Budget rows: shoppers here often start from what they can spend. */
export function PriceRows({ categories }: { categories: StoreCategory[] }) {
  const q = useDiscoveryCatalog()
  const products = q.data?.products ?? []
  const rows = [
    { key: "gifts", title: `Gifts under ${formatMoney(200, null, { compact: true })}`, max: 200 },
    { key: "home", title: `Home upgrades under ${formatMoney(1000, null, { compact: true })}`, max: 1000, department: "home-living" },
  ]
  return (
    <>
      {rows.map((r) => (
        <Row key={r.key} title={r.title} subtitle="Cheapest first" products={priceRow(products, categories, r.max, r.department)} />
      ))}
    </>
  )
}

/** Listings whose sellers state they were made in Ghana. */
export function MadeInGhanaRow() {
  const q = useQuery({
    queryKey: ["store", "discovery", "made-in", "ghana"],
    queryFn: () => listStoreProducts({ limit: ROW_MAX, sort: "newest", madeIn: "ghana" }),
    staleTime: 300_000,
  })
  return (
    <Row
      eyebrow="Proudly local"
      title="Made in Ghana"
      subtitle="Handmade and locally made, as stated by each seller"
      products={q.data?.products ?? []}
      loading={q.isLoading}
    />
  )
}

/** Every listing, newest first, a page at a time. */
export function ExploreEverything() {
  const q = useInfiniteQuery({
    queryKey: ["store", "discovery", "explore"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listStoreProducts({ limit: EXPLORE_PAGE, offset: pageParam, sort: "newest" }),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.products.length, 0)
      return loaded < last.count && last.products.length > 0 ? loaded : undefined
    },
    staleTime: 120_000,
  })
  const products = q.data?.pages.flatMap((p) => p.products) ?? []
  const total = q.data?.pages[0]?.count ?? 0
  if (!q.isLoading && products.length === 0) return null
  return (
    <section className="container-page" aria-label="Explore everything">
      <SectionHeader title="Explore everything" subtitle={total ? `${total} products, newest first` : undefined} />
      <ProductGrid products={products} loading={q.isLoading} skeletons={10} />
      {q.hasNextPage ? (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" size="xl" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? "Loading…" : `Show more (${total - products.length} left)`}
          </Button>
        </div>
      ) : null}
    </section>
  )
}
