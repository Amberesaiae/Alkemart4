import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Call02Icon,
  Calendar03Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  Location01Icon,
  PackageIcon,
  Search01Icon,
  Share01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ProductGrid, ProductRail } from "@/components/commerce/product-grid"
import { Rating, Stars } from "@/components/commerce/rating"
import { SellerAvatar } from "@/components/commerce/seller-avatar"
import { ShopSocials } from "@/components/commerce/shop-socials"
import { SectionHeader } from "@/components/commerce/section-header"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { getSellerVerifications, getStoreVendorBySlug, listStoreCollections } from "@/lib/vendors"
import { listStoreProducts } from "@/lib/products"
import { deliveryLabel } from "@alkemart/shared/storefront-badges"
import { storeJsonLd } from "@/lib/seo"
import { trackSellerStoreViewed } from "@/lib/analytics"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/shops/$slug")({
  component: StorePage,
})

function StorePage() {
  const { slug } = Route.useParams()
  const [query, setQuery] = useState("")
  const [dept, setDept] = useState<string | null>(null)

  const vendorQ = useQuery({ queryKey: ["store", "vendor", slug], queryFn: () => getStoreVendorBySlug(slug) })
  const vendor = vendorQ.data?.vendor
  const verificationsQ = useQuery({
    queryKey: ["store", "vendor", slug, "verifications"],
    queryFn: () => getSellerVerifications(slug),
    enabled: vendorQ.isSuccess,
    staleTime: 300_000,
  })
  const productsQ = useQuery({
    queryKey: ["store", "shop-products", slug],
    queryFn: () => listStoreProducts({ limit: 200, sellerHandle: slug }),
    enabled: vendorQ.isSuccess,
  })
  const collectionsQ = useQuery({
    queryKey: ["store", "vendor", slug, "collections"],
    queryFn: () => listStoreCollections(vendor!.id),
    enabled: Boolean(vendor?.id),
    staleTime: 300_000,
  })

  useEffect(() => {
    if (vendorQ.isSuccess) trackSellerStoreViewed({ sellerHandle: slug, sellerId: vendor?.id ?? null })
  }, [vendorQ.isSuccess, slug, vendor?.id])

  const products = useMemo(() => productsQ.data?.products ?? [], [productsQ.data])
  const departments = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) if (p.categoryLabel) m.set(p.categoryLabel, (m.get(p.categoryLabel) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [products])
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter(
      (p) => (!dept || p.categoryLabel === dept) && (!needle || p.title.toLowerCase().includes(needle)),
    )
  }, [products, query, dept])
  const featuredIds = vendorQ.data?.featuredProductIds ?? []
  const featured = featuredIds.flatMap((id) => products.filter((p) => p.id === id))

  if (vendorQ.isError) {
    const missing = vendorQ.error instanceof Error && vendorQ.error.message === "Store not found"
    return (
      <div className="container-page py-10">
        <PageSeo title="Store not found" noindex />
        {missing ? (
          <EmptyState title="This store isn't on alkemart" description="The link may be old." action={{ label: "Browse stores", to: "/shops" }} />
        ) : (
          <ErrorState title="This store didn't load" error={vendorQ.error} onRetry={() => void vendorQ.refetch()} />
        )}
      </div>
    )
  }
  if (!vendor) {
    return (
      <div className="container-page space-y-6 pt-6">
        <Skeleton className="h-48 rounded-[2rem]" />
        <Skeleton className="h-8 w-60" />
      </div>
    )
  }

  const t = vendor.trust
  const verified = verificationsQ.data ?? []
  const cover = vendor.coverWebUrl ?? vendor.coverImageUrl
  const paused = vendor.availability?.state === "paused"
  const days = vendor.deliveryDays
  const delivery = days
    ? `Delivers in ${days.min === days.max ? days.min : `${days.min}–${days.max}`} day${days.max === 1 ? "" : "s"}`
    : deliveryLabel(vendor.deliveryMinutes)
  const whatsapp = t?.social.whatsapp ?? null

  return (
    <div className="space-y-8 pt-4 sm:pt-6">
      <PageSeo
        title={vendor.name}
        description={vendor.bio ?? t?.tagline ?? `Shop ${vendor.name} on alkemart.`}
        path={`/shops/${slug}`}
        image={cover}
        jsonLd={storeJsonLd({
          name: vendor.name,
          path: `/shops/${slug}`,
          description: vendor.bio ?? null,
          location: t?.location ?? null,
        })}
      />

      <section className="container-page">
        <div className="overflow-hidden rounded-[2rem] border border-border">
          {/* No cover yet: a short plain strip, not decorative filler. */}
          <div className={cn("relative bg-muted", cover ? "h-32 sm:h-56" : "h-16 sm:h-24")}>
            {cover ? <img src={cover} alt="" className="size-full object-cover" /> : null}
          </div>
          <div className="flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:gap-4 sm:px-8 sm:pb-6">
            {/* Phones: avatar and actions share one row; wider screens lay them out in the header row. */}
            <div className="flex items-end justify-between sm:contents">
            <SellerAvatar name={vendor.name} logo={vendor.logoWebUrl ?? vendor.logoImageUrl} size="xl" className="-mt-10 ring-4 ring-background sm:-mt-12" />
            <div className="flex gap-2 sm:order-last">
              {whatsapp ? (
                <Button asChild variant="outline">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <HugeiconsIcon icon={WhatsappIcon} data-icon="inline-start" /> Chat
                  </a>
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="icon"
                aria-label="Share store"
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ title: vendor.name, url: location.href })
                    else {
                      await navigator.clipboard.writeText(location.href)
                      toast("Link copied")
                    }
                  } catch {
                    /* dismissed */
                  }
                }}
              >
                <HugeiconsIcon icon={Share01Icon} />
              </Button>
            </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold sm:text-3xl">{vendor.name}</h1>
                {verified.map((v) => (
                  <Tooltip key={v.id}>
                    <TooltipTrigger asChild>
                      <Badge className="cursor-help bg-success-soft text-success">
                        <HugeiconsIcon icon={CheckmarkBadge01Icon} data-icon="inline-start" />
                        {v.kind === "identity" ? "ID verified" : v.kind === "business" ? "Registered business" : v.kind === "fulfillment_proven" ? "Proven delivery" : v.kind === "brand_auth" ? "Authorised seller" : "Contact verified"}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{v.meaning}</TooltipContent>
                  </Tooltip>
                ))}
                {(vendor.badges ?? []).map((b) => (
                  <Badge key={b.id} variant="secondary">
                    {b.label}
                  </Badge>
                ))}
              </div>
              {t?.tagline || vendor.bio ? <p className="line-clamp-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t?.tagline ?? vendor.bio}</p> : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <Rating avg={t?.ratingAvg} count={t?.ratingCount} />
                {vendor.replyTime?.label ? <span>{vendor.replyTime.label}</span> : null}
                {t?.location ? (
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={Location01Icon} className="size-4" /> {t.location}
                  </span>
                ) : null}
                {delivery ? (
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={Clock01Icon} className="size-4" /> {delivery}
                  </span>
                ) : null}
                {/* A count starts meaning something at a few orders; 1–2 reads as noise. */}
                {t?.salesCount && t.salesCount >= 3 ? (
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={PackageIcon} className="size-4" /> {t.salesCount.toLocaleString()} {t.salesCount === 1 ? "order" : "orders"}
                  </span>
                ) : null}
              </div>
              {t ? <ShopSocials social={t.social} className="pt-1.5" /> : null}
            </div>
          </div>
          {paused || t?.announcement ? (
            <div className="border-t border-border bg-surface px-5 py-3 text-sm sm:px-8">
              {paused
                ? `This shop is paused${vendor.availability?.note ? ` — ${vendor.availability.note}` : ""}. You can browse, but checkout is closed until it reopens.`
                : t?.announcement}
            </div>
          ) : null}
        </div>
      </section>

      <Tabs defaultValue="products" className="container-page">
        <TabsList>
          <TabsTrigger value="products">Products{products.length ? ` (${products.length})` : ""}</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="reviews">Reviews{t?.ratingCount ? ` (${t.ratingCount})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6 space-y-10">
          {featured.length ? (
            <section>
              <SectionHeader title="Featured" />
              <ProductRail products={featured} label="Featured products" />
            </section>
          ) : null}
          {(collectionsQ.data ?? []).map((c) => (
            <section key={c.id}>
              <SectionHeader
                title={c.name}
                subtitle={c.description}
                action={{ label: "See all", to: "/shops/collections/$collectionId", params: { collectionId: c.id }, search: { shop: slug } }}
              />
              <ProductRail products={c.cards} label={c.name} />
            </section>
          ))}
          <section>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-extrabold">All products</h2>
              <div className="relative sm:w-72">
                <HugeiconsIcon icon={Search01Icon} className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${vendor.name}`} className="pl-10" aria-label="Search this store" />
              </div>
            </div>
            {departments.length > 1 ? (
              <div className="rail mb-5">
                {[null, ...departments.map(([d]) => d)].map((d) => (
                  <Button key={d ?? "all"} size="sm" variant={dept === d ? "default" : "secondary"} onClick={() => setDept(d)}>
                    {d ?? "All"}
                  </Button>
                ))}
              </div>
            ) : null}
            {productsQ.isError ? (
              <ErrorState error={productsQ.error} onRetry={() => void productsQ.refetch()} />
            ) : !productsQ.isLoading && visible.length === 0 ? (
              <EmptyState
                title={products.length ? "No products match" : "No products yet"}
                illustration={products.length ? "no-results" : "first-listing"}
                description={products.length ? "Try a different word." : `${vendor.name} hasn't listed anything yet.`}
              />
            ) : (
              <ProductGrid products={visible} loading={productsQ.isLoading} />
            )}
          </section>
        </TabsContent>

        <TabsContent value="about" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold">About {vendor.name}</h2>
              <p className="leading-relaxed whitespace-pre-line text-muted-foreground">
                {vendor.bio || "This seller hasn't written an introduction yet."}
              </p>
              {t?.policy ? (
                <dl className="grid gap-3 sm:grid-cols-3">
                  {t.policy.returnsDays != null ? (
                    <div className="rounded-2xl bg-surface p-4">
                      <dt className="text-xs text-muted-foreground">Returns</dt>
                      <dd className="font-semibold">{t.policy.returnsDays ? `${t.policy.returnsDays} days` : "No change-of-mind returns"}</dd>
                    </div>
                  ) : null}
                  {t.policy.warranty ? (
                    <div className="rounded-2xl bg-surface p-4">
                      <dt className="text-xs text-muted-foreground">Warranty</dt>
                      <dd className="font-semibold">{t.policy.warranty}</dd>
                    </div>
                  ) : null}
                  {t.policy.shipping ? (
                    <div className="rounded-2xl bg-surface p-4">
                      <dt className="text-xs text-muted-foreground">Delivery</dt>
                      <dd className="font-semibold">{t.policy.shipping}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
            <ul className="space-y-3 rounded-3xl border border-border p-5 text-sm">
              {t?.hours ? (
                <li className="flex items-center gap-2">
                  <HugeiconsIcon icon={Clock01Icon} className="size-4" /> {t.hours.days}, {t.hours.open}–{t.hours.close}
                </li>
              ) : null}
              {t?.phone ? (
                <li className="flex items-center gap-2">
                  <HugeiconsIcon icon={Call02Icon} className="size-4" />
                  <a href={`tel:${t.phone}`} className="hover:underline">{t.phone}</a>
                </li>
              ) : null}
              {t?.location ? (
                <li className="flex items-center gap-2">
                  <HugeiconsIcon icon={Location01Icon} className="size-4" />
                  {vendor.lat != null && vendor.lng != null ? (
                    <a href={`https://www.google.com/maps?q=${vendor.lat},${vendor.lng}`} target="_blank" rel="noreferrer" className="hover:underline">
                      {t.location} · map
                    </a>
                  ) : (
                    t.location
                  )}
                </li>
              ) : null}
              {t?.memberSince ? (
                <li className="flex items-center gap-2">
                  <HugeiconsIcon icon={Calendar03Icon} className="size-4" /> Selling since{" "}
                  {new Date(t.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </li>
              ) : null}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          {t?.recentReviews.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {t.recentReviews.map((r, i) => (
                <li key={i} className="space-y-1.5 rounded-3xl bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} />
                    <time className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</time>
                  </div>
                  {r.title ? <p className="font-semibold">{r.title}</p> : null}
                  <p className="text-sm text-muted-foreground">{r.body}</p>
                  <p className="text-xs text-muted-foreground">On {r.productTitle}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("rounded-3xl bg-surface p-6 text-sm text-muted-foreground")}>
              No reviews yet. Reviews come from buyers after delivery.
            </p>
          )}
          <p className="mt-6 text-sm">
            <Link to="/shops" className="font-semibold hover:underline">← All stores</Link>
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
