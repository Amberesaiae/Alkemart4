import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Avatar, AvatarFallback, AvatarImage, Button, Input, MerchEmpty, Skeleton } from "@workspace/ui"
import { Clock, MapPin, Megaphone, Phone, SealCheck, Truck } from "@phosphor-icons/react"
import { ProductCard } from "@/components/product/ProductCard"
import { ProductGridSkeleton } from "@/components/skeletons"
import { listStoreProducts } from "@/lib/products"
import { getStoreVendorBySlug } from "@/lib/vendors"

export const Route = createFileRoute("/shops/$slug")({
  component: ShopPage,
})

function ShopPage() {
  const { slug } = Route.useParams()
  const [query, setQuery] = useState("")

  const vendorQ = useQuery({
    queryKey: ["store", "vendor", slug],
    queryFn: () => getStoreVendorBySlug(slug),
  })
  const productsQ = useQuery({
    queryKey: ["store", "products", "seller", slug],
    queryFn: () => listStoreProducts({ limit: 48, sellerHandle: slug }),
    enabled: vendorQ.isSuccess,
  })

  const vendor = vendorQ.data?.vendor
  const name = vendor?.name
  const trust = vendor?.trust ?? null
  const products = productsQ.data?.products ?? []

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.title.toLowerCase().includes(q))
  }, [products, query])

  const featuredIds = vendorQ.data?.featuredProductIds ?? []
  const featuredProducts = featuredIds.flatMap((id) => {
    const hit = visibleProducts.find((item) => item.id === id)
    return hit ? [hit] : []
  })
  const featuredSet = new Set(featuredProducts.map((item) => item.id))
  const shelfProducts = visibleProducts.filter((item) => !featuredSet.has(item.id))
  const sinceYear = trust?.memberSince ? new Date(trust.memberSince).getFullYear() : null

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-1">/</span>
        <Link to="/shops" className="hover:underline">
          Stores
        </Link>
        <span className="mx-1">/</span>
        <span className="font-medium text-foreground">{name ?? slug}</span>
      </nav>

      {vendorQ.isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading store">
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : null}

      {vendorQ.isError ? (
        <MerchEmpty
          title="Store not found"
          body={vendorQ.error instanceof Error ? vendorQ.error.message : "Seller not found."}
          action={
            <Button className="rounded-full" asChild>
              <Link to="/shops">Stores</Link>
            </Button>
          }
        />
      ) : null}

      {vendor && name ? (
        <div className="space-y-4">
          {vendor.availability?.state === "paused" ? (
            <div role="status" className="rounded-2xl border border-border bg-muted p-4">
              <p className="font-bold">This shop is taking a break.</p>
              {vendor.availability.note ? (
                <p className="mt-1 text-sm text-muted-foreground">{vendor.availability.note}</p>
              ) : null}
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Listings stay visible, but checkout is disabled until the seller returns.
              </p>
            </div>
          ) : null}

          {trust?.announcement ? (
            <p
              role="status"
              className="flex items-start gap-2.5 rounded-2xl border border-primary/40 bg-card px-4 py-3 text-sm font-semibold shadow-sm"
            >
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" weight="fill" />
              {trust.announcement}
            </p>
          ) : null}

          {vendor.coverImageUrl ? (
            <div className="h-44 w-full overflow-hidden rounded-2xl sm:h-60">
              <img
                src={vendor.coverWebUrl ?? vendor.coverImageUrl}
                alt=""
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
            </div>
          ) : null}

          <header
            className={
              "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" +
              (vendor.coverImageUrl ? " relative mx-3 -mt-16 sm:mx-6 sm:-mt-20" : "")
            }
          >
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="h-20 w-20 rounded-2xl text-3xl font-bold ring-2 ring-background shadow-sm">
                <AvatarImage
                  src={vendor.logoImageUrl ?? undefined}
                  alt={`${name} logo`}
                  className="h-full w-full object-cover"
                />
                <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{name}</h1>
                {trust?.tagline ? (
                  <p className="text-sm font-medium text-muted-foreground">{trust.tagline}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {trust && trust.ratingCount > 0 && trust.ratingAvg !== null ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      {trust.ratingAvg} · {trust.ratingCount} review{trust.ratingCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="font-medium text-muted-foreground">New shop — no reviews yet</span>
                  )}
                  {trust && trust.salesCount > 0 ? (
                    <span className="font-medium text-muted-foreground">
                      {trust.salesCount.toLocaleString()} sale{trust.salesCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {trust?.location ? (
                    <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {trust.location}
                    </span>
                  ) : null}
                  {sinceYear ? (
                    <span className="font-medium text-muted-foreground">Since {sinceYear}</span>
                  ) : null}
                </div>
                {vendor.bio ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{vendor.bio}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {trust?.phone ? (
                    <a
                      href={`tel:${trust.phone}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-bold transition-colors hover:border-primary/60"
                    >
                      <Phone className="h-4 w-4" /> {trust.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
        </div>
      ) : null}

      {vendor && products.length > 0 ? (
        <div className="sticky top-0 z-10 -mx-1 border-y border-border/60 bg-background/95 px-1 py-2 backdrop-blur">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this shop…"
            aria-label="Search this shop"
            className="h-10 max-w-64 rounded-full"
          />
        </div>
      ) : null}

      {vendor && productsQ.isLoading ? <ProductGridSkeleton count={8} /> : null}

      {vendor && !productsQ.isLoading && products.length === 0 ? (
        <MerchEmpty
          title="No products yet"
          body="This shop has no listings right now."
          action={
            <Button className="rounded-full" asChild>
              <Link to="/">Browse</Link>
            </Button>
          }
        />
      ) : null}

      {featuredProducts.length > 0 ? (
        <section className="space-y-3" aria-label="Featured by this shop">
          <h2 className="text-lg font-bold tracking-tight">Handpicked by {name}</h2>
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
            {featuredProducts.map((p) => (
              <div key={p.id} className="w-44 shrink-0 snap-start sm:w-52">
                <ProductCard product={p} size="tile" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {shelfProducts.length > 0 ? (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shelfProducts.map((p) => (
              <ProductCard key={p.id} product={p} size="tile" />
            ))}
          </div>
        </section>
      ) : null}

      {vendor && trust ? (
        <section className="grid gap-3 md:grid-cols-2" aria-label="About this shop">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold tracking-tight">About {name}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {vendor.bio ?? `${name} sells on Alkemart. Ask the seller anything before you buy.`}
            </p>
            <dl className="space-y-2 border-t border-border/60 pt-3 text-sm">
              {trust.location ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <dd className="font-medium">{trust.location}</dd>
                </div>
              ) : null}
              {trust.hours ? (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <dd className="font-medium">
                    {trust.hours.days} · {trust.hours.open}–{trust.hours.close}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold tracking-tight">Shop policies</h2>
            {trust.policy?.shipping ? (
              <div className="flex items-start gap-2.5 text-sm">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">Delivery. </span>
                  {trust.policy.shipping}
                </p>
              </div>
            ) : null}
            {typeof trust.policy?.returnsDays === "number" ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">Returns. </span>
                {trust.policy.returnsDays}-day returns, no questions asked.
              </p>
            ) : null}
            {trust.policy?.warranty ? (
              <div className="flex items-start gap-2.5 text-sm">
                <SealCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">Warranty. </span>
                  {trust.policy.warranty}
                </p>
              </div>
            ) : null}
            {!trust.policy?.shipping &&
            typeof trust.policy?.returnsDays !== "number" &&
            !trust.policy?.warranty ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                No written policies yet — message the seller for delivery and return terms before ordering.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
