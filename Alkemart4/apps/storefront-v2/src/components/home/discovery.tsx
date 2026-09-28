import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { rotationPick } from "@alkemart/shared/homepage"
import { ProductRail } from "@/components/commerce/product-grid"
import { SectionHeader } from "@/components/commerce/section-header"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/market"
import { listPopularProducts, listStoreProducts, type StoreCategory, type StoreProductCard } from "@/lib/products"
import { getStoreVendorBySlug, listStoreVendors, type StoreVendor } from "@/lib/vendors"

/**
 * Homepage discovery, planned as one page: rows fill top to bottom and a
 * product shown in one row is never repeated in a later one. A row left with
 * fewer than MIN_ROW products hides rather than padding with unrelated items,
 * so a small catalogue gets a short, honest page that grows with it.
 */
export const MIN_ROW = 4
const ROW_MAX = 12
/** One newest-first page feeds the department and price rows (API max 100). */
const DISCOVERY_PAGE = 96

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
}

/**
 * Fills rows in page order, skipping products already shown. A row is kept
 * only if it still has `min` products; kept rows claim theirs.
 */
export function createClaims(alreadyShown: Iterable<string> = []) {
  const shown = new Set(alreadyShown)
  return {
    take(list: StoreProductCard[], max = ROW_MAX, min = MIN_ROW): StoreProductCard[] {
      const fresh = list.filter((p) => !shown.has(p.id)).slice(0, max)
      if (fresh.length < min) return []
      for (const p of fresh) shown.add(p.id)
      return fresh
    },
  }
}

/** Category ids/handles (leaf and every ancestor) that have at least one listing. */
export function stockedCategories(products: StoreProductCard[], categories: StoreCategory[]): Set<string> {
  const byKey = new Map<string, StoreCategory>()
  for (const c of categories) {
    byKey.set(c.id, c)
    if (c.handle) byKey.set(c.handle, c)
  }
  const out = new Set<string>()
  for (const p of products) {
    let node = byKey.get(p.categoryHandles?.[0] ?? "")
    for (let hops = 0; node && hops < 8; hops++) {
      out.add(node.id)
      if (node.handle) out.add(node.handle)
      node = node.parentCategoryId ? byKey.get(node.parentCategoryId) : undefined
    }
  }
  return out
}

export type HomeRow = { key: string; title: string; eyebrow?: string; subtitle?: string; products: StoreProductCard[]; action?: Parameters<typeof SectionHeader>[0]["action"] }
export type HomeSpotlight = { shop: StoreVendor; line: string | null; products: StoreProductCard[] }

/** Everything below "Fresh picks", resolved in page order with no repeats. */
export function useHomeDiscovery(categories: StoreCategory[], alreadyShown: string[]) {
  const now = new Date()
  const catalogQ = useQuery({
    queryKey: ["store", "discovery", "catalog"],
    queryFn: () => listStoreProducts({ limit: DISCOVERY_PAGE, sort: "newest" }),
    staleTime: 300_000,
  })
  const popularQ = useQuery({
    queryKey: ["store", "discovery", "popular"],
    queryFn: () => listPopularProducts({ limit: ROW_MAX, window: "7d" }),
    staleTime: 300_000,
  })
  const madeQ = useQuery({
    queryKey: ["store", "discovery", "made-in", "ghana"],
    queryFn: () => listStoreProducts({ limit: 24, sort: "newest", madeIn: "ghana" }),
    staleTime: 300_000,
  })
  // Shop story: one shop a week, in turn, among open shops with a cover.
  const vendorsQ = useQuery({ queryKey: ["store", "vendors"], queryFn: listStoreVendors, staleTime: 300_000 })
  const eligible = (vendorsQ.data ?? []).filter((v) => v.availability !== "paused" && Boolean(v.banner)).sort((a, b) => a.slug.localeCompare(b.slug))
  const pick = rotationPick(eligible, 1, now, 7)[0]
  const shopQ = useQuery({
    queryKey: ["store", "vendor", pick?.slug],
    queryFn: () => getStoreVendorBySlug(pick!.slug),
    enabled: Boolean(pick),
    staleTime: 300_000,
  })
  const shopProductsQ = useQuery({
    queryKey: ["store", "spotlight", "products", pick?.slug],
    queryFn: () => listStoreProducts({ sellerHandle: pick!.slug, limit: 24 }),
    enabled: Boolean(pick),
    staleTime: 300_000,
  })

  // Known as soon as the catalogue loads; null means "not known yet, show everything".
  const stocked = catalogQ.data && categories.length ? stockedCategories(catalogQ.data.products, categories) : null

  // Rows wait for every source, so claims resolve in one consistent order.
  const loading = catalogQ.isLoading || popularQ.isLoading || madeQ.isLoading || vendorsQ.isLoading || shopProductsQ.isLoading
  if (loading || !categories.length) return { loading, stocked, top: [] as HomeRow[], spotlight: null, middle: [] as HomeRow[], bottom: [] as HomeRow[] }

  const all = catalogQ.data?.products ?? []
  const claims = createClaims(alreadyShown)
  const row = (r: Omit<HomeRow, "products">, list: StoreProductCard[]): HomeRow[] => {
    const products = claims.take(list)
    return products.length ? [{ ...r, products }] : []
  }

  // Shop of the week picks first: four of its own listings, which later rows skip.
  const spotlight: HomeSpotlight | null = pick
    ? { shop: pick, line: shopQ.data?.vendor.bio ?? pick.tagline ?? pick.bio ?? null, products: claims.take(shopProductsQ.data?.products ?? [], 4, 4) }
    : null

  const top = rotationPick(departmentRows(all, categories), 2, now, 1).flatMap(({ department, products }) =>
    row({ key: `dept-${department.id}`, title: department.name, subtitle: "Today's department · changes daily", action: { label: "See all", to: "/categories/$slug", params: { slug: department.handle ?? department.id } } }, products),
  )
  top.push(...row({ key: "popular", title: "Popular right now", subtitle: "What buyers ordered most this week" }, popularQ.data?.products ?? []))

  const middle = row({ key: "made-in-ghana", title: "Made in Ghana", subtitle: "Handmade and locally made, as stated by each seller" }, madeQ.data?.products ?? [])
  const bottom = [
    ...row({ key: "gifts", title: `Gifts under ${formatMoney(200, null, { compact: true })}`, subtitle: "Cheapest first" }, priceRow(all, categories, 200)),
    ...row({ key: "home", title: `Home upgrades under ${formatMoney(1000, null, { compact: true })}`, subtitle: "Cheapest first" }, priceRow(all, categories, 1000, "home-living")),
  ]
  return { loading, stocked, top, spotlight, middle, bottom }
}

export function HomeRows({ rows }: { rows: HomeRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <section key={r.key} className="container-page" aria-label={r.title}>
          <SectionHeader title={r.title} eyebrow={r.eyebrow} subtitle={r.subtitle} action={r.action} />
          <ProductRail products={r.products} label={r.title} />
        </section>
      ))}
    </>
  )
}

/** The end of the homepage: one door into the full catalogue. */
export function SeeAllProducts() {
  return (
    <div className="container-page flex justify-center">
      <Button asChild variant="outline" size="xl">
        <Link to="/categories/$slug" params={{ slug: "all" }}>See all products</Link>
      </Button>
    </div>
  )
}
