import { useEffect, useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ProductGridSkeleton, Skeleton } from "@/components/skeleton"
import { Avatar, AvatarFallback, AvatarImage, Badge } from "@workspace/ui"
import { listStoreProducts, type StoreProductCard } from "@/lib/products"
import { getStoreVendorBySlug } from "@/lib/vendors"
import { trackSellerStoreViewed } from "@/lib/analytics"
import { PageSeo } from "@/components/page-seo"
import { storeJsonLd, stripHtml, truncateMeta } from "@/lib/seo"
import { ProductRating } from "@/components/product/ProductRating"

export const Route = createFileRoute("/shops/$slug")({
  component: StorePage,
})

function StorePage() {
  const { slug } = Route.useParams()
  const vendorQ = useQuery({
    queryKey: ["store", "vendor", slug],
    queryFn: () => getStoreVendorBySlug(slug),
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
   * Flat grid fallback when all unlabeled. Newest first within groups.
   */
  const sections = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      const at = a.createdAt ? Date.parse(a.createdAt) : 0
      const bt = b.createdAt ? Date.parse(b.createdAt) : 0
      return bt - at || a.title.localeCompare(b.title)
    })
    const map = new Map<string, StoreProductCard[]>()
    for (const p of sorted) {
      const key = (p.categoryLabel || "").trim() || "All products"
      const arr = map.get(key) ?? []
      arr.push(p)
      map.set(key, arr)
    }
    const entries = [...map.entries()]
    // Prefer multi-section when more than one real category
    if (entries.length <= 1) {
      return [{ title: null as string | null, products: sorted }]
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
          <Skeleton className="h-56 w-full rounded-3xl" />
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
        <div className="space-y-4">
          {/* Cover art only when the seller supplied one — a big empty
              placeholder would read as unfinished. */}
          {vendor.coverImageUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-3xl">
              <img
                src={vendor.coverWebUrl ?? vendor.coverImageUrl}
                srcSet={
                  vendor.coverImageUrl
                    ? [
                        `${vendor.coverThumbUrl ?? vendor.coverImageUrl} 400w`,
                        `${vendor.coverWebUrl ?? vendor.coverImageUrl} 800w`,
                        `${vendor.coverImageUrl} 1600w`,
                      ].join(", ")
                    : undefined
                }
                sizes="100vw"
                alt=""
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
            </div>
          ) : null}

          <header className="store-hero overflow-hidden rounded-3xl border border-border p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="h-16 w-16 rounded-2xl text-2xl font-bold ring-2 ring-background">
                <AvatarImage
                  src={vendor.logoThumbUrl ?? vendor.logoImageUrl ?? undefined}
                  alt={`${name} logo`}
                  className="h-full w-full object-cover"
                />
                <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-2">
                <p className="type-sm font-semibold uppercase tracking-[0.14em] text-primary">
                  Seller store
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {name}
                </h1>
                {vendor.bio ? (
                  <p className="max-w-2xl type-sm leading-relaxed text-white/80">
                    {vendor.bio}
                  </p>
                ) : null}
                {vendor.ratingCount ? (
                  <div className="flex items-center gap-2.5">
                    <ProductRating
                      value={(vendor.ratingAvgX100 ?? 0) / 100}
                      size={14}
                    />
                    <span className="type-sm text-white/70">
                      {(vendor.ratingAvgX100 ?? 0) / 100} ·{" "}
                      {vendor.ratingCount} review
                      {vendor.ratingCount === 1 ? "" : "s"}
                    </span>
                    {vendor.badgeTopSeller ? (
                      <Badge className="font-semibold bg-white/20 text-white border-none">Top seller</Badge>
                    ) : null}
                    {vendor.badgeFastShipper ? (
                      <Badge className="font-semibold bg-white/20 text-white border-none">Fast shipper</Badge>
                    ) : null}
                  </div>
                ) : null}
                {products.length > 0 ? (
                  <p className="type-sm text-white/60">
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
                            className="inline-flex rounded-full bg-white/10 px-3 py-1 type-sm font-semibold text-white/90 ring-1 ring-white/20 hover:bg-white/20 transition-colors"
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
        </div>
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
