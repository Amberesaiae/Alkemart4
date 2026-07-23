import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckIcon, BookmarkIcon, BookmarkFilledIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useGetProduct, useListCategories, useListProducts } from "@/lib/hooks-products";
import { useAddCartItem } from "@/lib/hooks-cart";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ImageSlot } from "@/components/shop/image-slot";
import { PriceCents } from "@/components/shop/price-cents";
import { RatingStars } from "@/components/shop/rating-stars";
import { DealTag } from "@/components/shop/deal-tag";
import { SectionHeader } from "@/components/shop/section-header";
import { ProductRail } from "@/components/shop/product-rail";
import { FulfillmentPicker } from "@/components/shop/fulfillment-picker";
import { SaveBadge } from "@/components/shop/save-badge";
import { AlkemartPlusInline } from "@/components/shop/alkemart-plus-inline";
import { Skeleton } from "@/components/ui/skeleton";
import { useWishlist } from "@/hooks/use-wishlist";
import { pesewasToPrice, pesewasToLabel } from "@/lib/money";
import { ShopPage } from "@/components/shop/shop-page";

export const Route = createFileRoute("/_shop/ip/$id")({
  head: () => ({
    meta: [
      { title: "Product Details — alkemart Ghana" },
      {
        name: "description",
        content:
          "Product details on alkemart Ghana lab. Cash on delivery at checkout; delivery confirmed with seller options.",
      },
    ],
  }),
  component: ProductPage,
});

/**
 * Product detail page — API-driven only.
 * No Chromebook prototype content, fake reviews, compare tables, or FBT bundles.
 */
function ProductPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const {
    data: product,
    isLoading,
    isError,
    isPending,
  } = useGetProduct(id);
  const addCartItem = useAddCartItem();
  const { data: categories } = useListCategories();
  const category = categories?.find((c) => c.handle === product?.categoryHandle);
  const { saved, toggle } = useWishlist(product?.id);

  // Similar items: same category when known
  const { data: similar, isLoading: similarLoading } = useListProducts(
    product
      ? { categorySlug: category?.slug, limit: 6 }
      : undefined,
    { query: { enabled: Boolean(product && category?.slug), retry: false, throwOnError: false } },
  );

  useEffect(() => {
    if (product?.title) {
      document.title = `${product.title} — alkemart Ghana`;
    }
  }, [product]);

  const showLoading = (isPending || isLoading) && !isError && !product;
  const notFound = !showLoading && (isError || !product);

  if (showLoading) {
    return (
      <ShopPage className="space-y-8">
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading product…</span>
          <Skeleton className="h-4 w-48 bg-muted" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_min(100%,380px)]">
            <Skeleton className="aspect-square w-full rounded-2xl bg-muted" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4 bg-muted" />
              <Skeleton className="h-6 w-1/3 bg-muted" />
              <Skeleton className="h-10 w-40 bg-muted" />
              <Skeleton className="h-28 w-full rounded-2xl bg-muted" />
              <Skeleton className="h-12 w-full rounded-full bg-muted" />
              <Skeleton className="h-12 w-full rounded-full bg-muted" />
            </div>
          </div>
        </div>
      </ShopPage>
    );
  }

  if (notFound || !product) {
    return (
      <ShopPage className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This product may be unavailable or the link is incorrect.
        </p>
        <Button asChild className="rounded-full font-bold">
          <Link to="/">Continue shopping</Link>
        </Button>
      </ShopPage>
    );
  }

  const hasRating = product.ratingCount > 0;
  const saveAmount =
    product.compareAtPesewas && product.compareAtPesewas > product.pricePesewas
      ? pesewasToPrice(product.compareAtPesewas - product.pricePesewas)
      : null;
  const similarItems = (similar?.items ?? []).filter((p) => p.id !== product.id).slice(0, 6);

  const tagVariant =
    product.tag === "rollback" ||
    product.tag === "clearance" ||
    product.tag === "best" ||
    product.tag === "popular" ||
    product.tag === "new"
      ? product.tag
      : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || product.title,
    image: product.imageUrl || undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    sku: product.sku || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "GHS",
      price: (product.pricePesewas / 100).toFixed(2),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
    aggregateRating: hasRating
      ? {
          "@type": "AggregateRating",
          ratingValue: (product.ratingAvgX100 / 100).toFixed(1),
          reviewCount: product.ratingCount,
        }
      : undefined,
  };

  return (
    <ShopPage className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="text-link">
                Home
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {category && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/browse/$slug" params={{ slug: category.slug }} className="text-link">
                    {category.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold">{product.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero: gallery + buy box — only real media (single image until gallery API exists) */}
      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <ImageSlot
            ratio={1}
            rounded="2xl"
            tone="brand"
            src={product.imageUrl}
            alt={product.title}
          />
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap gap-2">
              {tagVariant && (
                <DealTag variant={tagVariant}>
                  {tagVariant === "rollback"
                    ? "Deal"
                    : tagVariant === "best"
                      ? "Best seller"
                      : tagVariant.charAt(0).toUpperCase() + tagVariant.slice(1)}
                </DealTag>
              )}
              {product.stock > 0 && product.stock <= 5 && (
                <DealTag variant="clearance">Only {product.stock} left</DealTag>
              )}
              {product.stock === 0 && <DealTag variant="outline">Out of stock</DealTag>}
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight">{product.title}</h1>
            {product.brand && (
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{product.brand}</p>
            )}
            {product.vendor && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sold by{" "}
                <Link
                  to="/store/$slug"
                  params={{ slug: product.vendor.slug }}
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {product.vendor.name}
                </Link>
              </p>
            )}
            {hasRating && (
              <div className="mt-2">
                <RatingStars
                  rating={product.ratingAvgX100 / 100}
                  count={`${product.ratingCount} rating${product.ratingCount === 1 ? "" : "s"}`}
                />
              </div>
            )}
          </div>

          {/* Buy box: price → pay/trust → delivery → CTA */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <PriceCents
              now={pesewasToPrice(product.pricePesewas)}
              was={
                product.compareAtPesewas
                  ? pesewasToPrice(product.compareAtPesewas)
                  : undefined
              }
              label={product.compareAtPesewas ? "Now" : undefined}
              size="xl"
              emphasis={product.tag === "rollback" ? "deal" : "default"}
            />
            {saveAmount && (
              <div className="mt-2">
                <SaveBadge amount={saveAmount} />
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              Price in GHS when purchased online
            </div>

            <div className="mt-4">
              <AlkemartPlusInline />
            </div>

            <Separator className="my-4" />

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery
              </div>
              <FulfillmentPicker selected="shipping" />
              <p className="mt-2 text-xs text-muted-foreground">
                Options depend on your area in Ghana and the seller. Confirmed at checkout.
              </p>
            </div>

            <Button
              className="mt-5 min-h-11 w-full rounded-full font-bold"
              size="lg"
              disabled={
                product.stock === 0 ||
                (!product.offerId && !product.variantId) ||
                addCartItem.isPending
              }
              onClick={() => {
                if (!product.offerId && !product.variantId) {
                  console.error("Product has no purchasable offer/variant", product.id);
                  return;
                }
                addCartItem.mutate({
                  data: {
                    offerId: product.offerId,
                    variantId: product.variantId,
                    qty: 1,
                  },
                });
              }}
            >
              {product.stock === 0
                ? "Out of stock"
                : !product.offerId && !product.variantId
                  ? "Unavailable"
                  : addCartItem.isPending
                    ? "Adding…"
                    : "Add to cart"}
            </Button>
            <Button
              variant="outline"
              className="mt-2 min-h-11 w-full rounded-full font-bold"
              size="lg"
              aria-pressed={saved}
              onClick={toggle}
            >
              {saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}
              {saved ? "Saved for later" : "Save for later"}
            </Button>

            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <CheckIcon className="mt-0.5 h-4 w-4 text-success" />
              <span>Returns follow the seller&apos;s policy shown after purchase.</span>
            </div>

            {product.vendor && (
              <>
                <Separator className="my-4" />
                <div className="text-sm">
                  <div className="font-semibold">
                    Sold by{" "}
                    <Link
                      to="/store/$slug"
                      params={{ slug: product.vendor.slug }}
                      className="text-link hover:underline"
                    >
                      {product.vendor.name}
                    </Link>
                  </div>
                  {product.vendor.ratingCount > 0 && (
                    <div className="mt-1 text-muted-foreground">
                      <RatingStars
                        rating={product.vendor.ratingAvgX100 / 100}
                        count={`${product.vendor.ratingCount} seller rating${product.vendor.ratingCount === 1 ? "" : "s"}`}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Description — only when API provides it */}
      {product.description?.trim() && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold tracking-tight">About this item</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        </section>
      )}

      {/* Stock / seller facts from API only */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold tracking-tight">Product facts</h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            ["Price", pesewasToLabel(product.pricePesewas)],
            product.compareAtPesewas
              ? ["Was", pesewasToLabel(product.compareAtPesewas)]
              : null,
            product.brand ? ["Brand", product.brand] : null,
            [
              "Availability",
              product.stock == null
                ? "Check availability at checkout"
                : product.stock > 0
                  ? `${product.stock} in stock`
                  : "Out of stock",
            ],
            category ? ["Category", category.name] : null,
            product.vendor ? ["Seller", product.vendor.name] : null,
          ]
            .filter(Boolean)
            .map((row) => {
              const [k, v] = row as [string, string];
              return (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-border py-2.5"
                >
                  <dt className="text-sm font-semibold">{k}</dt>
                  <dd className="text-sm text-muted-foreground">{v}</dd>
                </div>
              );
            })}
        </dl>
      </section>

      {/* Similar from same category — live only */}
      <section>
        <SectionHeader
          title="Similar items"
          linkTo={category ? `/browse/${category.slug}` : undefined}
          linkLabel="View category"
        />
        <ProductRail
          count={6}
          columns={6}
          products={similarItems}
          loading={similarLoading}
          showAdd
          emptyLabel="No similar products in this category yet."
        />
      </section>

      {/* Reviews: only rating aggregate until a reviews API exists */}
      {hasRating && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold tracking-tight">Customer ratings</h2>
          <div className="mt-4 flex items-center gap-4">
            <div className="text-4xl font-bold tabular-nums">
              {(product.ratingAvgX100 / 100).toFixed(1)}
            </div>
            <div>
              <RatingStars rating={product.ratingAvgX100 / 100} size="md" />
              <p className="mt-1 text-sm text-muted-foreground">
                Based on {product.ratingCount} rating{product.ratingCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Written reviews will appear here when available.
          </p>
        </section>
      )}

      {/* Policy FAQ — generic platform policy, not product fiction */}
      <section>
        <SectionHeader title="Shopping with alkemart" />
        <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card">
          {[
            {
              q: "Return policy",
              a: "Most items can be returned within 14 days to any alkemart Ghana hub. Some categories have special rules shown at checkout.",
            },
            {
              q: "Delivery options",
              a: "Pickup and delivery options depend on the seller and your address. Delivery windows are confirmed at checkout.",
            },
            {
              q: "Payments",
              a: "This lab supports cash on delivery. Mobile Money is not product-complete here.",
            },
          ].map((item, i) => (
            <AccordionItem key={item.q} value={`q-${i}`} className="border-border px-6">
              <AccordionTrigger className="text-sm font-semibold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </ShopPage>
  );
}
