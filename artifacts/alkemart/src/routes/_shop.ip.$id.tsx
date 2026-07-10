import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckIcon, BookmarkIcon, BookmarkFilledIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProduct,
  useAddCartItem,
  useListCategories,
  getGetCartQueryKey,
  getGetProductQueryKey,
} from "@workspace/api-client-react";
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
import { TextSkeleton } from "@/components/shop/text-skeleton";
import { SectionHeader } from "@/components/shop/section-header";
import { ProductRail } from "@/components/shop/product-rail";
import { ColorSwatch } from "@/components/shop/color-swatch";
import { FulfillmentPicker } from "@/components/shop/fulfillment-picker";
import { RatingHistogram } from "@/components/shop/rating-histogram";
import { ReviewRow } from "@/components/shop/review-row";
import { FbtBundle } from "@/components/shop/fbt-bundle";
import { SaveBadge } from "@/components/shop/save-badge";
import { AlkemartPlusInline } from "@/components/shop/alkemart-plus-inline";
import { useWishlist } from "@/hooks/use-wishlist";

export const Route = createFileRoute("/_shop/ip/$id")({
  head: () => ({
    meta: [
      { title: "Product Details — alkemart Ghana" },
      {
        name: "description",
        content:
          "Specs, ratings and reviews for products on alkemart Ghana. Free 14-day returns and same-hour Accra delivery.",
      },
      { property: "og:title", content: "Product Details — alkemart Ghana" },
      { property: "og:description", content: "Specs, ratings, reviews. Free 14-day returns in Ghana." },
    ],
  }),
  component: ProductPage,
});

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

const colors = [
  { label: "Forging Blue", tone: "brand" as const, active: true },
  { label: "Slate Silver", tone: "default" as const, active: false },
];

const highlights = [
  "The best of Google's ecosystem: Chromebooks run ChromeOS, the fast and secure operating system from Google.",
  "Get up to 8 hours of battery life so you can work and play with fewer charging breaks.",
  "128GB of storage plus 4GB of memory for smooth everyday performance.",
  "Ultra-thin 15.6-inch FHD display — great for movies, class, or a spreadsheet.",
  "1MP webcam with a physical shutter for privacy and peace of mind.",
  "Backlit keyboard with comfortable travel and layout designed for hours of typing.",
];

function ProductPage() {
  const { id } = Route.useParams();
  const productId = Number(id);
  const queryClient = useQueryClient();
  const { data: product } = useGetProduct(productId, {
    query: { enabled: !Number.isNaN(productId), queryKey: getGetProductQueryKey(productId) },
  });
  const addCartItem = useAddCartItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
    },
  });
  const { data: categories } = useListCategories();
  const category = categories?.find((c) => c.id === product?.categoryId);
  const { saved, toggle } = useWishlist(product?.id);

  useEffect(() => {
    if (product?.title) {
      document.title = `${product.title} — alkemart Ghana`;
    }
  }, [product]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-12 px-6 py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {category && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/browse/$slug" params={{ slug: category.slug }}>
                    {category.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product?.title ?? "Chromebook CX15"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero */}
      <section className="grid gap-6 lg:grid-cols-[80px_1fr_380px]">
        {/* Thumb rail */}
        <div className="order-2 flex gap-2 lg:order-1 lg:flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              aria-label={`Preview ${i + 1}`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${
                i === 0 ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              <ImageSlot
                ratio={1}
                rounded="md"
                tone={i % 2 === 0 ? "default" : "brand"}
              />
            </button>
          ))}
        </div>

        {/* Main image */}
        <div className="order-1 lg:order-2">
          <ImageSlot ratio={1} rounded="2xl" tone="brand" src={product?.imageUrl} alt={product?.title} />
        </div>

        {/* Right buy-box */}
        <div className="order-3 space-y-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <DealTag variant="popular">100+ bought since yesterday</DealTag>
              <DealTag variant="best">Best seller</DealTag>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold leading-tight">
              {product?.title ??
                'ASUS Chromebook CX15 Laptop, 15.6" FHD Display, Intel® Processor N50, 128GB Storage, 4GB RAM, ChromeOS, Forging Blue'}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <RatingStars
                rating={product && product.ratingCount > 0 ? product.ratingAvgX100 / 100 : 4.5}
                count={product && product.ratingCount > 0 ? `${product.ratingCount} reviews` : "4.3 · 73 reviews"}
              />
              <a
                href="#reviews"
                className="text-xs font-semibold text-primary underline"
              >
                Write a review
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <PriceCents
              now={product ? pesewasToPrice(product.pricePesewas) : "199.00"}
              was={product?.compareAtPesewas ? pesewasToPrice(product.compareAtPesewas) : "249.00"}
              label="Now"
              size="xl"
              emphasis="deal"
            />
            <div className="mt-2">
              <SaveBadge
                amount={
                  product?.compareAtPesewas
                    ? pesewasToPrice(product.compareAtPesewas - product.pricePesewas)
                    : "50.00"
                }
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Price when purchased online</div>
            <div className="mt-2">
              <AlkemartPlusInline />
            </div>

            <Separator className="my-4" />

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actual color
              </div>
              <div className="flex gap-2">
                {colors.map((c) => (
                  <ColorSwatch key={c.label} label={c.label} active={c.active} tone={c.tone} />
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How you'll get this item
              </div>
              <FulfillmentPicker selected="shipping" />
              <div className="mt-2 text-xs text-muted-foreground">
                Ships to <span className="font-semibold text-primary underline">Accra, Osu</span> · Arrives Mon, Jul 6
              </div>
            </div>

            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={!product || addCartItem.isPending}
              onClick={() => {
                if (product) addCartItem.mutate({ data: { productId: product.id, qty: 1 } });
              }}
            >
              {addCartItem.isPending ? "Adding…" : "Add to cart"}
            </Button>
            <Button
              variant="outline"
              className="mt-2 w-full"
              size="lg"
              aria-pressed={saved}
              disabled={!product}
              onClick={toggle}
            >
              {saved ? <BookmarkFilledIcon /> : <BookmarkIcon />}
              {saved ? "Saved for later" : "Save for later"}
            </Button>

            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <CheckIcon className="mt-0.5 h-4 w-4 text-success" />
              <span>Free 14-day returns to any alkemart Ghana hub. Gift eligible.</span>
            </div>

            <Separator className="my-4" />
            <div className="text-xs">
              <div className="font-semibold">
                Sold and shipped by{" "}
                {product ? (
                  <Link to="/store/$slug" params={{ slug: product.vendor.slug }} className="text-primary underline">
                    {product.vendor.name}
                  </Link>
                ) : (
                  "alkemart Accra"
                )}
              </div>
              <div className="mt-1 text-muted-foreground">
                <RatingStars
                  rating={product && product.vendor.ratingCount > 0 ? product.vendor.ratingAvgX100 / 100 : 4.8}
                  count={
                    product && product.vendor.ratingCount > 0
                      ? `${product.vendor.ratingCount} seller reviews`
                      : "1.2k seller reviews"
                  }
                />
              </div>
              <button className="mt-2 font-semibold text-primary underline">Report an issue</button>
            </div>
          </div>

          <div className="rounded-2xl bg-foreground p-4 text-background">
            <div className="text-xs font-bold">alkemart Pay Later</div>
            <div className="mt-2 text-sm">
              As low as <span className="font-bold">GH₵35/mo</span> — no credit impact to apply.
            </div>
            <Button variant="outline" size="sm" className="mt-3 bg-background text-foreground">
              Learn more
            </Button>
          </div>
        </div>
      </section>

      {/* Key highlights */}
      <section className="rounded-2xl border border-border p-6">
        <h2 className="font-display text-xl font-bold">Key highlights</h2>
        <ul className="mt-4 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          {highlights.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* About this item */}
      <section>
        <SectionHeader title="About this item" />
        <Accordion
          type="multiple"
          defaultValue={["details"]}
          className="rounded-2xl border border-border"
        >
          {[
            { key: "details", label: "Product details", lines: 5 },
            { key: "specs", label: "Specifications", lines: 0 },
            { key: "warranty", label: "Warranty", lines: 3 },
            { key: "brand", label: "About the brand", lines: 3 },
          ].map((sec) => (
            <AccordionItem key={sec.key} value={sec.key} className="border-border px-6">
              <AccordionTrigger className="text-base font-bold">
                {sec.label}
              </AccordionTrigger>
              <AccordionContent>
                {sec.key === "specs" ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {[
                      ["CPU", "Intel N50"],
                      ["RAM", "4 GB"],
                      ["Storage", "128 GB eMMC"],
                      ["Display", "15.6\" FHD"],
                      ["Battery", "Up to 8 hours"],
                      ["Weight", "3.75 lbs"],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between border-b border-border py-2"
                      >
                        <span className="text-sm font-semibold">{k}</span>
                        <span className="text-sm text-muted-foreground">{v}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <TextSkeleton
                    lines={sec.lines}
                    widths={["100%", "95%", "97%", "90%", "60%"]}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Similar items */}
      <section>
        <SectionHeader title="Similar items you might love" linkTo="/browse/$slug" />
        <ProductRail count={5} columns={5} tag="best" />
      </section>

      {/* Reviews */}
      <section id="reviews" className="rounded-2xl border border-border p-6">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <RatingHistogram average={4.3} total={73} />
            <Button variant="outline" className="w-full">
              Write a review
            </Button>
          </div>

          <div>
            <h3 className="font-display text-lg font-bold">Customer photos</h3>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <ImageSlot key={i} ratio={1} rounded="lg" tone="brand" />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Recent reviews</h3>
              <div className="text-xs">
                <span className="text-muted-foreground">Sort by</span>{" "}
                <button className="font-semibold text-primary underline">
                  Most helpful
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-6">
              {[
                { rating: 5, title: "Good bang for your buck!" },
                { rating: 4.5, title: "Amazing operating laptop for everyday" },
                { rating: 4, title: "Easily replacing my old laptop" },
              ].map((r) => (
                <ReviewRow
                  key={r.title}
                  rating={r.rating}
                  title={r.title}
                  verified
                  photoCount={2}
                />
              ))}
            </div>
            <Button variant="outline" className="mt-4">
              View all 73 reviews
            </Button>
          </div>
        </div>
      </section>

      {/* Compare with similar items */}
      <section>
        <SectionHeader title="Compare with similar items" />
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="p-4 text-left font-semibold">Feature</th>
                {Array.from({ length: 3 }).map((_, i) => (
                  <th key={i} className="p-4 text-left">
                    <div className="w-32">
                      <ImageSlot ratio={4 / 3} rounded="md" tone="brand" />
                    </div>
                    <div className="mt-2 text-xs font-normal text-muted-foreground">
                      Product {i + 1}
                    </div>
                    <Button size="sm" className="mt-2">
                      Add
                    </Button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Price", "GH₵199", "GH₵229", "GH₵249"],
                ["RAM", "4 GB", "8 GB", "8 GB"],
                ["Storage", "128 GB", "256 GB", "512 GB"],
                ["Screen", "15.6\"", "14\"", "15.6\""],
                ["Weight", "3.75 lbs", "3.1 lbs", "3.9 lbs"],
              ].map(([k, ...vals]) => (
                <tr key={k} className="border-t border-border">
                  <td className="p-4 font-semibold">{k}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="p-4 text-muted-foreground">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Frequently bought together */}
      <section>
        <SectionHeader title="Frequently bought together" />
        <FbtBundle itemCount={3} bundlePrice="304.97" />
      </section>

      {/* FAQ */}
      <section>
        <SectionHeader title="Common questions" />
        <Accordion type="single" collapsible className="rounded-2xl border border-border">
          {["Return policy", "Warranty details", "Shipping options", "Assembly required"].map(
            (q, i) => (
              <AccordionItem key={q} value={`q-${i}`} className="border-border px-6">
                <AccordionTrigger className="text-sm font-semibold">
                  {q}
                </AccordionTrigger>
                <AccordionContent>
                  <TextSkeleton lines={2} />
                </AccordionContent>
              </AccordionItem>
            ),
          )}
        </Accordion>
      </section>
    </div>
  );
}
