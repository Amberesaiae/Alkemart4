import { useEffect, useMemo, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { Skeleton, StoreProductGridSkeleton } from "@/components/skeleton"
import { Badge } from "@workspace/ui"
import {
  CalendarBlank,
  CaretRight,
  ChatCircleText,
  Clock,
  FirstAidKit,
  FacebookLogo,
  InstagramLogo,
  MagnifyingGlass,
  MapPin,
  Megaphone,
  Phone,
  SealCheck,
  ShieldCheck,
  Star,
  Storefront,
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

const HUBTEL_RETAIL_TAXONOMY: Record<string, string[]> = {
  "Drinks, Snacks & Treats": ["All", "Beverages & Non-Alcoholic", "Ice Creams", "Snacks"],
  "Bakery & Dairy": ["All", "Bakery", "Dairy, Deli & Egg"],
  "Cooking Essentials": ["All", "Food Cupboard", "Oils & Sauces"],
  "Books & Stationery": ["All", "Books & Stationery"],
  "Pet Care": ["All", "Pet Care"],
  "Frozen Foods": ["All", "Frozen"],
  "Babies & Toys": ["All", "Toys & Entertainment", "Baby Care"],
  "Household & Personal Care": ["All", "Household", "Personal Care", "Raincoats & Umbrellas"],
  "Electronics": ["All", "Home & Electronics"],
  "Kitchen": ["All", "Food Cupboard", "Oils & Sauces", "Meat & Seafood", "Dairy, Deli & Egg"],
  "Breakfast & Quick Meals": ["All", "Dairy, Deli & Egg", "Bakery", "Fruits & Vegetables"],
  "Fruits & Vegetables": ["All", "Fruits & Vegetables"],
  "Alcohol": ["All", "Alcohol"],
}

function StorePage() {
  const { slug } = Route.useParams()
  const [query, setQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeSubCategory, setActiveSubCategory] = useState<string>("All")

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
  const isRestaurant = Boolean(vendor?.coverImageUrl)

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
    const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    return entries.map(([title, products]) => ({
      title: title === "All products" ? null : title,
      products,
    }))
  }, [shelfProducts])

  const retailCategories = useMemo(() => {
    const fromSections = sections
      .map((s) => s.title)
      .filter((t): t is string => Boolean(t))
    if (fromSections.length > 0) return fromSections
    return [
      "Drinks, Snacks & Treats",
      "Bakery & Dairy",
      "Cooking Essentials",
      "Books & Stationery",
      "Pet Care",
      "Frozen Foods",
      "Babies & Toys",
      "Household & Personal Care",
    ]
  }, [sections])

  const currentCategory = activeCategory ?? retailCategories[0] ?? "Drinks, Snacks & Treats"

  const currentSubCategories = useMemo(() => {
    if (HUBTEL_RETAIL_TAXONOMY[currentCategory]) {
      return HUBTEL_RETAIL_TAXONOMY[currentCategory]
    }
    return ["All"]
  }, [currentCategory])

  const retailFilteredProducts = useMemo(() => {
    if (query.trim()) return shelfProducts
    let list = shelfProducts
    const matching = list.filter(
      (p) => (p.categoryLabel || "").trim().toLowerCase() === currentCategory.toLowerCase(),
    )
    if (matching.length > 0) {
      list = matching
    }
    if (activeSubCategory !== "All") {
      const sub = activeSubCategory.toLowerCase()
      const matchingSub = list.filter((p) => {
        const text = `${p.title} ${p.description ?? ""} ${(p.categoryHandles ?? []).join(" ")}`.toLowerCase()
        return (
          text.includes(sub) ||
          (sub.includes("beverage") && (text.includes("drink") || text.includes("juice") || text.includes("soda") || text.includes("water") || text.includes("wine") || text.includes("coffee") || text.includes("tea"))) ||
          (sub.includes("snack") && (text.includes("chips") || text.includes("biscuit") || text.includes("cookie") || text.includes("snack"))) ||
          (sub.includes("ice cream") && text.includes("ice cream")) ||
          (sub.includes("dairy") && (text.includes("milk") || text.includes("cheese") || text.includes("yogurt") || text.includes("butter") || text.includes("egg"))) ||
          (sub.includes("bakery") && (text.includes("bread") || text.includes("cake") || text.includes("pastry") || text.includes("croissant")))
        )
      })
      if (matchingSub.length > 0) {
        list = matchingSub
      }
    }
    return list
  }, [shelfProducts, query, currentCategory, activeSubCategory])

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
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-sm text-muted-foreground scrollbar-none">
        <Link to={vendor?.coverImageUrl ? "/" : "/shops"} className="hover:text-foreground transition-colors">
          {vendor?.coverImageUrl ? "Home" : "Stores"}
        </Link>
        <span aria-hidden="true" className="text-border">›</span>
        <span className="truncate font-bold text-foreground">{name ?? slug}</span>
      </nav>

      {vendorQ.isLoading ? (
        <StorePageSkeleton />
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
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            {vendor.coverImageUrl ? (
              <div className="relative h-52 w-full overflow-hidden sm:h-72">
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
                  className="h-full w-full object-cover object-[center_25%]"
                  loading="eager"
                />
              </div>
            ) : null}

            <header className="p-5 sm:p-6 bg-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="type-pdp-title text-foreground">
                      {name}
                    </h1>
                    {vendor.badgeTopSeller ? (
                      <Badge className="gap-1 font-semibold bg-tone-neutral-soft text-foreground border-none [&_svg]:text-tone-success-ink">
                        <SealCheck className="h-3.5 w-3.5" weight="fill" /> Top seller
                      </Badge>
                    ) : null}
                    {vendor.badgeFastShipper ? (
                      <Badge className="gap-1 font-semibold bg-tone-neutral-soft text-foreground border-none [&_svg]:text-tone-success-ink">
                        <Truck className="h-3.5 w-3.5" /> Fast shipper
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground font-medium">
                    {trust?.location ? (
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" /> {trust.location}
                      </span>
                    ) : null}
                    {trust?.location ? (
                      <span aria-hidden="true" className="text-border">•</span>
                    ) : null}
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />{" "}
                      {typeof vendor.deliveryMinutes === "number"
                        ? `${vendor.deliveryMinutes} mins delivery`
                        : "Delivery set at checkout"}
                    </span>
                    {/* An unrated shop shows no rating at all — never an
                        invented 4.1 or a phantom "58 reviews". */}
                    {trust?.ratingAvg != null && trust.ratingCount > 0 ? (
                      <>
                        <span aria-hidden="true" className="text-border">•</span>
                        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-foreground">
                          <Star className="h-4 w-4 fill-primary text-primary" weight="fill" />
                          {trust.ratingAvg}
                        </span>
                        <a
                          href="#buyer-reviews"
                          className="inline-flex shrink-0 items-center gap-0.5 font-medium text-foreground transition-colors hover:underline"
                        >
                          {trust.ratingCount} review{trust.ratingCount === 1 ? "" : "s"}
                          <CaretRight className="h-3.5 w-3.5" weight="bold" />
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="relative w-full sm:w-80 md:w-96 shrink-0">
                  <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={vendor.coverImageUrl ? "Search Menu" : `Search ${name}`}
                    aria-label={vendor.coverImageUrl ? "Search Menu" : `Search ${name}`}
                    className="h-11 sm:h-12 w-full rounded-[10px] border border-border bg-card pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </header>

            {/* Status banner — paused shops and real seller announcements
                only. Never a hardcoded "closing soon": without hours data it
                shows on open shops too, which is dishonest. */}
            {vendor.availability?.state === "paused" ? (
              <div role="status" className="flex items-center gap-2.5 bg-primary px-5 py-3.5 sm:px-6 text-sm font-bold text-primary-foreground shadow-xs">
                <Storefront className="h-5 w-5 shrink-0" weight="fill" />
                <span>This shop is taking a break. Listings stay visible, but checkout is disabled.</span>
              </div>
            ) : trust?.announcement ? (
              <div role="status" className="flex items-center gap-2.5 bg-primary px-5 py-3.5 sm:px-6 text-sm font-bold text-primary-foreground shadow-xs">
                <Megaphone className="h-5 w-5 shrink-0" weight="fill" />
                <span>{trust.announcement}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {vendor && products.length > 0 ? (
        <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          {/* Tier-1 Category Tabs Strip */}
          <div className="scrollbar-none flex items-center gap-6 sm:gap-8 overflow-x-auto px-2 pt-3">
            {isRestaurant ? (
              // Restaurant Mode: "Most Popular" + menu sections
              <>
                <a
                  href="#most-popular"
                  className="inline-flex shrink-0 items-center border-b-2 border-primary pb-3 -mb-px text-sm font-bold text-foreground transition-colors"
                >
                  Most Popular
                </a>
                {sections.map((s) => {
                  const label = s.title ?? "All products"
                  return (
                    <a
                      key={label}
                      href={s.title ? `#store-cat-${slugify(s.title)}` : "#all"}
                      className="inline-flex shrink-0 items-center border-b-2 border-transparent pb-3 -mb-px text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {label}
                    </a>
                  )
                })}
              </>
            ) : (
              // Retail Supermarket Mode (Melcom Labone style)
              retailCategories.map((cat) => {
                const isActive = cat.toLowerCase() === currentCategory.toLowerCase()
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat)
                      setActiveSubCategory("All")
                    }}
                    className={cn(
                      "inline-flex shrink-0 items-center border-b-2 pb-3 -mb-px text-sm transition-colors cursor-pointer",
                      isActive
                        ? "border-primary font-bold text-foreground"
                        : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cat}
                  </button>
                )
              })
            )}
          </div>

          {/* Tier-2 Subcategory Pills Strip for Retail Mode */}
          {!isRestaurant && currentSubCategories.length > 1 && !query.trim() ? (
            <div className="flex items-center gap-2 overflow-x-auto px-2 py-3 border-t border-border scrollbar-none">
              {currentSubCategories.map((sub) => {
                const isActive = sub.toLowerCase() === activeSubCategory.toLowerCase()
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setActiveSubCategory(sub)}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-1.5 text-xs transition-colors cursor-pointer",
                      isActive
                        ? "bg-ink text-white font-semibold shadow-xs"
                        : "bg-tone-neutral-soft text-muted-foreground hover:bg-border font-medium",
                    )}
                  >
                    {sub}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {vendor && productsQ.isLoading ? (
        <div className="space-y-6">
          <div className="flex gap-2.5 overflow-hidden border-b border-border pb-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-24 shrink-0 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-8 w-40 rounded-lg" />
          <StoreProductGridSkeleton count={10} />
        </div>
      ) : null}

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

      {/* Retail Mode (Melcom Labone style): Clean 5-column product grid directly under tabs/pills */}
      {!isRestaurant && visibleProducts.length > 0 ? (
        <div className="space-y-4">
          {query.trim() ? (
            <h2 className="text-base font-semibold text-foreground">
              Results for &ldquo;{query.trim()}&rdquo; ({retailFilteredProducts.length})
            </h2>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
            {retailFilteredProducts.map((p) => (
              <ProductCard key={p.id} product={p} size="store" />
            ))}
          </div>
        </div>
      ) : null}

      {/* Restaurant Mode (Chiq "N" Grill style): Most Popular + Menu sections */}
      {isRestaurant && featuredProducts.length > 0 ? (
        <section id="store-featured" className="space-y-3 scroll-mt-24" aria-label="Featured by this shop">
          <div className="flex items-baseline justify-between">
            <h2 className="type-section text-foreground">Most Popular</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} product={p} size="store" />
            ))}
          </div>
        </section>
      ) : null}

      {isRestaurant && visibleProducts.length > 0
        ? sections.map((section) => (
            <section
              key={section.title ?? "all"}
              id={section.title ? `store-cat-${slugify(section.title)}` : "all"}
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
                {section.products.map((p) => (
                  <ProductCard key={p.id} product={p} size="store" />
                ))}
              </div>
            </section>
          ))
        : null}

      {trust && (trust.recentReviews.length > 0 || (trust.ratingCount > 0 && trust.ratingAvg !== null)) ? (
        <section id="buyer-reviews" className="space-y-3 scroll-mt-24" aria-label="Shop reviews">
          <h2 className="type-section text-foreground">Buyer reviews</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {trust.ratingAvg !== null ? (
              <div className="flex flex-col justify-center rounded-2xl border border-border bg-card p-5">
                <p className="text-4xl font-bold text-foreground">{trust.ratingAvg}</p>
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

/** Mirrors the loaded store shell so the route does not jump as data arrives (matches Hubtel Image 1). */
function StorePageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading store">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <Skeleton className="h-48 w-full rounded-none sm:h-64" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
            </div>
            <Skeleton className="h-12 w-full shrink-0 rounded-xl sm:w-80 md:w-96" />
          </div>
        </div>
      </div>

      <div className="border-b border-border px-3">
        <div className="flex h-12 items-end gap-6 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className="relative flex h-full shrink-0 items-center pb-2">
              <Skeleton className={`h-4 rounded ${index === 0 ? "w-28" : "w-24"}`} />
              {index === 0 ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" /> : null}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-1 py-1">
        <Skeleton className="h-7 w-36 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>

      <section className="space-y-4" aria-label="Loading store section">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-36 rounded-lg" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <StoreProductGridSkeleton count={10} />
      </section>
    </div>
  )
}
