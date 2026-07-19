import { useEffect, useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ProductGridSkeleton, Skeleton } from "@/components/skeleton"
import { getBackendUrl, getPublishableKey } from "@/lib/env"
import { listStoreProducts, type StoreProductCard } from "@/lib/products"
import { trackSellerStoreViewed } from "@/lib/analytics"
import { PageSeo } from "@/components/page-seo"
import { storeJsonLd, stripHtml, truncateMeta } from "@/lib/seo"

export const Route = createFileRoute("/shops/$slug")({
  component: StorePage,
})

type VendorPayload = {
  vendor?: {
    id?: string
    name?: string
    slug?: string
    bio?: string | null
  }
}

async function fetchVendorBySlug(slug: string) {
  const base = getBackendUrl()
  const pk = getPublishableKey()
  const res = await fetch(
    `${base}/store/alkemart/vendors/${encodeURIComponent(slug)}`,
    {
      headers: {
        Accept: "application/json",
        "x-publishable-api-key": pk,
      },
    },
  )
  if (res.status === 404) throw new Error("Store not found")
  if (!res.ok) throw new Error(`Failed to load store (${res.status})`)
  return (await res.json()) as VendorPayload
}

function StorePage() {
  const { slug } = Route.useParams()
  const vendorQ = useQuery({
    queryKey: ["store", "vendor", slug],
    queryFn: () => fetchVendorBySlug(slug),
  })

  /** Server catalog filter by open seller handle (slug). No client invent. */
  const productsQ = useQuery({
    queryKey: ["store", "products", "seller", slug],
    queryFn: () =>
      listStoreProducts({
        limit: 48,
        sellerHandle: slug,
      }),
    enabled: vendorQ.isSuccess,
  })

  const vendor = vendorQ.data?.vendor
  const name = vendor?.name
  const products = productsQ.data?.products ?? []

  useEffect(() => {
    if (!vendorQ.isSuccess) return
    trackSellerStoreViewed({
      sellerHandle: slug,
      sellerId: vendor?.id ?? null,
    })
  }, [vendorQ.isSuccess, slug, vendor?.id])

  /**
   * Multi-category store arrangement (Mowafer + Ghana marketplace):
   * Group by categoryLabel from catalog (server taxonomy).
   * Flat grid fallback when all unlabeled.
   */
  const sections = useMemo(() => {
    const map = new Map<string, StoreProductCard[]>()
    for (const p of products) {
      const key = (p.categoryLabel || "").trim() || "All products"
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    const entries = [...map.entries()]
    // Prefer multi-section when more than one real category
    if (entries.length <= 1) {
      return [{ title: null as string | null, products }]
    }
    return entries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, products]) => ({ title, products }))
  }, [products])

  const storePath = `/shops/${slug}`

  return (
    <div className="space-y-6">
      {name ? (
        <PageSeo
          title={name}
          description={
            vendor?.bio
              ? truncateMeta(stripHtml(String(vendor.bio)))
              : `Shop ${name} on alkemart`
          }
          path={storePath}
          jsonLd={storeJsonLd({
            name,
            description: vendor?.bio ? String(vendor.bio) : null,
            path: storePath,
          })}
        />
      ) : null}
      <nav className="text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-1">/</span>
        <Link to="/shops" className="hover:underline">
          Sellers
        </Link>
        <span className="mx-1">/</span>
        <span className="font-medium text-foreground">{name ?? slug}</span>
      </nav>

      {vendorQ.isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading store">
          <Skeleton className="h-28 w-full rounded-3xl" />
        </div>
      ) : null}

      {vendorQ.isError ? (
        <EmptyState
          illustration="marketplace"
          title="Store not found"
          description={
            vendorQ.error instanceof Error
              ? vendorQ.error.message
              : "Seller not found."
          }
          actionLabel="Sellers"
          actionTo="/shops"
        />
      ) : null}

      {vendor && name ? (
        <header className="store-hero overflow-hidden rounded-3xl border border-border p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="type-sm font-semibold uppercase tracking-[0.14em] text-primary">
                Seller store
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {name}
              </h1>
              {vendor.bio ? (
                <p className="max-w-2xl type-sm leading-relaxed text-white/70">
                  {vendor.bio}
                </p>
              ) : null}
              {products.length > 0 ? (
                <p className="type-sm text-white/55">
                  {products.length} product{products.length === 1 ? "" : "s"} in
                  catalog
                  {sections.length > 1
                    ? ` · ${sections.length} departments`
                    : ""}
                </p>
              ) : null}
              {/* Derived multi-category chips (product taxonomy, not seller SoR) */}
              {sections.length > 1 ? (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {sections.map((s) =>
                    s.title ? (
                      <li key={s.title}>
                        <a
                          href={`#store-cat-${slugify(s.title)}`}
                          className="inline-flex rounded-full bg-white/10 px-3 py-1 type-sm font-semibold text-white/90 ring-1 ring-white/15 hover:bg-white/15"
                        >
                          {s.title}
                          <span className="ml-1.5 opacity-60">
                            {s.products.length}
                          </span>
                        </a>
                      </li>
                    ) : null,
                  )}
                </ul>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

      {vendor && productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

      {vendor && !productsQ.isLoading && products.length === 0 ? (
        <EmptyState
          illustration="emptyCatalog"
          title="No products yet"
          description="This shop has no listings right now."
          actionLabel="Browse"
          actionTo="/"
        />
      ) : null}

      {products.length > 0
        ? sections.map((section) => (
            <section
              key={section.title ?? "all"}
              id={
                section.title
                  ? `store-cat-${slugify(section.title)}`
                  : undefined
              }
              className="space-y-3"
            >
              {section.title ? (
                <h2 className="type-section text-foreground">
                  {section.title}
                </h2>
              ) : null}
              <ProductGridShell>
                {section.products.map((p) => (
                  <ProductCard key={p.id} product={p} size="tile" />
                ))}
              </ProductGridShell>
            </section>
          ))
        : null}
    </div>
  )
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
