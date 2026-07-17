import { useEffect } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ProductGridSkeleton, Skeleton } from "@/components/skeleton"
import { getBackendUrl, getPublishableKey } from "@/lib/env"
import { listStoreProducts } from "@/lib/products"
import { trackSellerStoreViewed } from "@/lib/analytics"
import { PageSeo } from "@/components/page-seo"
import { storeJsonLd, stripHtml, truncateMeta } from "@/lib/seo"

export const Route = createFileRoute("/store/$slug")({
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

  const productsQ = useQuery({
    queryKey: ["store", "products", "all-for-seller", slug],
    queryFn: () => listStoreProducts({ limit: 48 }),
    enabled: vendorQ.isSuccess,
  })

  const vendor = vendorQ.data?.vendor
  const name = vendor?.name

  useEffect(() => {
    if (!vendorQ.isSuccess) return
    trackSellerStoreViewed({
      sellerHandle: slug,
      sellerId: vendor?.id ?? null,
    })
  }, [vendorQ.isSuccess, slug, vendor?.id])

  const filtered =
    productsQ.data?.products.filter((p) => {
      if (!vendor) return false
      if (p.seller?.handle && vendor.slug) {
        return p.seller.handle === vendor.slug
      }
      if (p.seller?.name && name) {
        return p.seller.name === name
      }
      if (p.seller?.id && vendor.id) {
        return p.seller.id === vendor.id
      }
      return false
    }) ?? []

  const storePath = `/store/${slug}`

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
        <Link to="/sellers" className="hover:underline">
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
          title="Store not found"
          description={
            vendorQ.error instanceof Error
              ? vendorQ.error.message
              : "No seller for this slug from the API."
          }
          actionLabel="Sellers"
          actionTo="/sellers"
        />
      ) : null}

      {vendor && name ? (
        <header className="overflow-hidden rounded-3xl border border-border bg-[linear-gradient(135deg,#1a1a1a_0%,#2a2a2a_100%)] p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                Seller store
              </p>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {name}
              </h1>
              {vendor.bio ? (
                <p className="max-w-2xl text-sm leading-relaxed text-white/70">
                  {vendor.bio}
                </p>
              ) : null}
              {filtered.length > 0 ? (
                <p className="text-sm text-white/55">
                  {filtered.length} product{filtered.length === 1 ? "" : "s"} in
                  catalog
                </p>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}

      {vendor && productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

      {vendor && !productsQ.isLoading && filtered.length === 0 ? (
        <EmptyState
          title="No products linked to this seller"
          description="Seller exists, but product list did not include matching seller fields."
          actionLabel="All products"
          actionTo="/"
        />
      ) : null}

      {filtered.length > 0 ? (
        <ProductGridShell>
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ProductGridShell>
      ) : null}
    </div>
  )
}
