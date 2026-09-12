import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { ProductGridSkeleton, Skeleton } from "@/components/skeleton"
import { Avatar, AvatarFallback, AvatarImage, Badge } from "@workspace/ui"
import {
  CalendarBlank,
  ChatCircleText,
  Clock,
  FacebookLogo,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Megaphone,
  Phone,
  SealCheck,
  ShieldCheck,
  TiktokLogo,
  Truck,
  WhatsappLogo,
} from "@phosphor-icons/react"
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
  const [query, setQuery] = useState("")
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
  const trust = vendor?.trust ?? null
  const products = productsQ.data?.products ?? []

  /** In-shop search narrows every shelf below (Etsy-style "search this shop"). */
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
    const sorted = [...shelfProducts].sort((a, b) => {
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
  }, [shelfProducts])

  const storePath = `/shops/${slug}`
  const sinceYear = trust?.memberSince ? new Date(trust.memberSince).getFullYear() : null
  const whatsapp = trust?.social.whatsapp
  const socials = [
    trust?.social.instagram ? { label: "Instagram", href: trust.social.instagram, Icon: InstagramLogo } : null,
    trust?.social.facebook ? { label: "Facebook", href: trust.social.facebook, Icon: FacebookLogo } : null,
    trust?.social.tiktok ? { label: "TikTok", href: trust.social.tiktok, Icon: TiktokLogo } : null,
  ].filter((s): s is { label: string; href: string; Icon: typeof InstagramLogo } => s !== null)

  return (
    <div className="space-y-5">
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
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
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
          {vendor.availability?.state === "paused" ? (
            <div role="status" className="p-4 rounded-2xl bg-tone-warning-soft text-tone-warning-ink border border-tone-warning-ink/25">
              <p className="font-bold text-warning-fg">This shop is taking a break.</p>
              {vendor.availability.note ? (
                <p className="text-sm text-warning-fg/90 mt-1">{vendor.availability.note}</p>
              ) : null}
              {vendor.availability.pausedUntil ? (
                <p className="text-sm text-warning-fg/80 mt-1 font-medium">
                  Back {new Date(vendor.availability.pausedUntil).toLocaleDateString()}
                </p>
              ) : null}
              <p className="text-xs text-warning-fg/70 mt-2 font-medium">
                Listings stay visible, but checkout is disabled until the seller returns.
              </p>
            </div>
          ) : null}

          {trust?.announcement ? (
            <p role="status" className="flex items-start gap-2.5 rounded-2xl border border-primary/40 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm">
              <Megaphone className="h-4 w-4 mt-0.5 shrink-0 text-primary" weight="fill" />
              {trust.announcement}
            </p>
          ) : null}

          {vendor.coverImageUrl ? (
            <div className="h-44 w-full overflow-hidden rounded-3xl sm:h-60">
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

          <header
            className={
              "rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" +
              (vendor.coverImageUrl ? " mx-3 sm:mx-6 -mt-16 relative sm:-mt-20" : "")
            }
          >
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="h-20 w-20 rounded-2xl text-3xl font-bold ring-2 ring-background shadow-sm">
                <AvatarImage
                  src={vendor.logoThumbUrl ?? vendor.logoImageUrl ?? undefined}
                  alt={`${name} logo`}
                  className="h-full w-full object-cover"
                />
                <AvatarFallback className="rounded-2xl bg-primary text-primary-foreground">
                  {name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {name}
                  </h1>
                  {vendor.badgeTopSeller ? (
                    <Badge className="gap-1 font-semibold bg-muted text-foreground border border-border [&_svg]:text-primary">
                      <SealCheck className="h-3.5 w-3.5" weight="fill" /> Top seller
                    </Badge>
                  ) : null}
                  {vendor.badgeFastShipper ? (
                    <Badge className="gap-1 font-semibold bg-muted text-foreground border border-border [&_svg]:text-primary">
                      <Truck className="h-3.5 w-3.5" /> Fast shipper
                    </Badge>
                  ) : null}
                </div>
                {trust?.tagline ? (
                  <p className="text-sm font-medium text-muted-foreground">{trust.tagline}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {trust && trust.ratingCount > 0 && trust.ratingAvg !== null ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                      <ProductRating value={trust.ratingAvg} size={14} />
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
                    <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                      <CalendarBlank className="h-3.5 w-3.5" /> Since {sinceYear}
                    </span>
                  ) : null}
                </div>
                {vendor.bio ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {vendor.bio}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {whatsapp ? (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#1FA855] px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#178A45]"
                    >
                      <WhatsappLogo className="h-4 w-4" weight="fill" /> Chat seller
                    </a>
                  ) : null}
                  {trust?.phone ? (
                    <a
                      href={`tel:${trust.phone}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/60"
                    >
                      <Phone className="h-4 w-4" /> {trust.phone}
                    </a>
                  ) : null}
                  {socials.map(({ label, href, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${name} on ${label}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </header>
        </div>
      ) : null}

      {vendor && products.length > 0 ? (
        <div className="sticky top-0 z-10 -mx-1 border-y border-border/60 bg-background/95 px-1 py-2 backdrop-blur">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="relative min-w-44 flex-1 sm:max-w-64">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search this shop…`}
                aria-label="Search this shop"
                className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              {sections.length > 1
                ? sections.map((s) =>
                    s.title ? (
                      <a
                        key={s.title}
                        href={`#store-cat-${slugify(s.title)}`}
                        className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/60"
                      >
                        {s.title}
                        <span className="ml-1.5 text-muted-foreground">{s.products.length}</span>
                      </a>
                    ) : null,
                  )
                : null}
            </div>
          </div>
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

      {vendor && !productsQ.isLoading && products.length > 0 && visibleProducts.length === 0 ? (
        <EmptyState
          illustration="emptyCatalog"
          title={`Nothing matching “${query.trim()}”`}
          description="Try a different search, or clear it to browse the full shelf."
          actionLabel="Clear search"
          actionOnClick={() => setQuery("")}
        />
      ) : null}

      {featuredProducts.length > 0 ? (
        <section className="space-y-3" aria-label="Featured by this shop">
          <div className="flex items-baseline justify-between">
            <h2 className="type-section text-foreground">Handpicked by {name}</h2>
            <span className="text-xs font-semibold text-muted-foreground">Seller's top picks</span>
          </div>
          <div
            className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            tabIndex={0}
            role="region"
            aria-label={`Featured by ${name}`}
          >
            {featuredProducts.map((p) => (
              <div key={p.id} className="w-44 shrink-0 snap-start sm:w-52">
                <ProductCard product={p} size="tile" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {visibleProducts.length > 0
        ? sections.map((section) => (
            <section
              key={section.title ?? "all"}
              id={
                section.title
                  ? `store-cat-${slugify(section.title)}`
                  : undefined
              }
              className="space-y-3 scroll-mt-24"
            >
              {section.title ? (
                <div className="flex items-baseline justify-between">
                  <h2 className="type-section text-foreground">{section.title}</h2>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {section.products.length} item{section.products.length === 1 ? "" : "s"}
                  </span>
                </div>
              ) : null}
              <ProductGridShell>
                {section.products.map((p) => (
                  <ProductCard key={p.id} product={p} size="tile" />
                ))}
              </ProductGridShell>
            </section>
          ))
        : null}

      {trust && (trust.recentReviews.length > 0 || (trust.ratingCount > 0 && trust.ratingAvg !== null)) ? (
        <section className="space-y-3" aria-label="Shop reviews">
          <h2 className="type-section text-foreground">Buyer reviews</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {trust.ratingAvg !== null ? (
              <div className="flex flex-col justify-center rounded-2xl border border-border bg-card p-5">
                <p className="text-4xl font-black tracking-tight text-foreground">{trust.ratingAvg}</p>
                <ProductRating value={trust.ratingAvg} size={16} />
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {trust.ratingCount} review{trust.ratingCount === 1 ? "" : "s"} across this shop
                </p>
              </div>
            ) : null}
            {trust.recentReviews.slice(0, trust.ratingAvg !== null ? 2 : 3).map((r, i) => (
              <figure key={`${r.createdAt}-${i}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
                <ProductRating value={r.rating} size={14} />
                <blockquote className="text-sm leading-relaxed text-foreground">“{r.body}”</blockquote>
                <figcaption className="mt-auto text-xs font-medium text-muted-foreground">
                  {r.productTitle} · {new Date(r.createdAt).toLocaleDateString()}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {vendor && trust ? (
        <section className="grid gap-3 md:grid-cols-2" aria-label="About this shop">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="type-section text-foreground">About {name}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {vendor.bio ?? `${name} sells on Alkemart. Ask the seller anything before you buy.`}
            </p>
            <dl className="space-y-2 border-t border-border/60 pt-3 text-sm">
              {trust.location ? (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <dt className="sr-only">Location</dt>
                  <dd className="font-medium text-foreground">{trust.location}</dd>
                </div>
              ) : null}
              {sinceYear ? (
                <div className="flex items-center gap-2">
                  <CalendarBlank className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <dt className="sr-only">Member since</dt>
                  <dd className="font-medium text-foreground">Selling since {sinceYear}</dd>
                </div>
              ) : null}
              {trust.hours ? (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <dt className="sr-only">Hours</dt>
                  <dd className="font-medium text-foreground">
                    {trust.hours.days} · {trust.hours.open}–{trust.hours.close}
                  </dd>
                </div>
              ) : null}
              {trust.phone || whatsapp ? (
                <div className="flex items-center gap-2">
                  <ChatCircleText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <dt className="sr-only">Contact</dt>
                  <dd className="font-medium text-foreground">Replies on WhatsApp{trust.phone ? ` or ${trust.phone}` : ""}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="type-section text-foreground">Shop policies</h2>
            {trust.policy?.shipping ? (
              <div className="flex items-start gap-2.5 text-sm">
                <Truck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">Delivery. </span>
                  {trust.policy.shipping}
                </p>
              </div>
            ) : null}
            {typeof trust.policy?.returnsDays === "number" ? (
              <div className="flex items-start gap-2.5 text-sm">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">Returns. </span>
                  {trust.policy.returnsDays}-day returns, no questions asked.
                </p>
              </div>
            ) : null}
            {trust.policy?.warranty ? (
              <div className="flex items-start gap-2.5 text-sm">
                <SealCheck className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p className="leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">Warranty. </span>
                  {trust.policy.warranty}
                </p>
              </div>
            ) : null}
            {!trust.policy?.shipping && typeof trust.policy?.returnsDays !== "number" && !trust.policy?.warranty ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                No written policies yet — message the seller for delivery and return terms before ordering.
              </p>
            ) : null}
            {socials.length > 0 ? (
              <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                {socials.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${name} on ${label}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
