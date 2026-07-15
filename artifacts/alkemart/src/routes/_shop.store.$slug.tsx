import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts } from "@/lib/hooks-products";
import { useAddCartItem } from "@/lib/hooks-cart";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/shop/product-card";
import { RatingStars } from "@/components/shop/rating-stars";
import { ImageSlot } from "@/components/shop/image-slot";
import { pesewasToLabel, pesewasToPrice } from "@/lib/money";
import { ShopPage } from "@/components/shop/shop-page";

export const Route = createFileRoute("/_shop/store/$slug")({
  head: ({ params }) => ({
    meta: [{ title: `${params.slug} — alkemart Ghana` }],
  }),
  component: StorePage,
});


function StorePage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();
  const { data } = useListProducts({ limit: 24 });
  const addCartItem = useAddCartItem();

  const products = data?.items ?? [];

  if (!vendorLoading && (error || !vendor)) {
    return (
      <ShopPage className="py-16 text-center">
        <h1 className="font-display text-xl font-bold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find a storefront for "{slug}".
        </p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary underline">
          Back to home
        </Link>
      </ShopPage>
    );
  }

  return (
    <ShopPage dense className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{vendor?.name ?? "Store"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="rounded-md border border-border bg-surface p-6">
        <div className="grid gap-6 md:grid-cols-[120px_1fr]">
          <div className="w-[120px]">
            <ImageSlot ratio={1} rounded="md" tone="brand" src={vendor?.logoImageUrl} alt={vendor?.name} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{vendor?.name ?? "…"}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <RatingStars
                rating={vendor && vendor.ratingCount > 0 ? vendor.ratingAvgX100 / 100 : 0}
                count={vendor ? `${vendor.ratingCount} reviews` : ""}
              />
              {vendor?.badgeTopSeller && <Badge variant="secondary">Top seller</Badge>}
              {vendor?.badgeFastShipper && <Badge variant="secondary">Fast shipper</Badge>}
            </div>
            {vendor?.bio && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{vendor.bio}</p>}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">Products</span> ({data?.total ?? 0})
          </span>
        </div>
        {products.length === 0 ? (
          <p className="rounded-md border border-border p-8 text-center text-sm text-muted-foreground">
            This store has no products yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p, i: number) => (
              <ProductCard
                key={p.id}
                id={p.id}
                title={p.title}
                tag={(p.tag as "rollback" | "clearance" | "best" | "popular" | "new" | null) ?? undefined}
                now={pesewasToPrice(p.pricePesewas)}
                was={p.compareAtPesewas ? pesewasToPrice(p.compareAtPesewas) : undefined}
                rating={p.ratingCount > 0 ? p.ratingAvgX100 / 100 : undefined}
                reviews={p.ratingCount > 0 ? p.ratingCount : undefined}
                imageUrl={p.imageUrl}
                showAdd={i % 2 === 0}
                showOptions={i % 2 !== 0}
                emphasis={i % 4 === 0 ? "deal" : "default"}
                onAdd={() => {
                  if (!p.variantId) {
                    console.error("Product has no purchasable variant", p.id);
                    return;
                  }
                  addCartItem.mutate({ data: { variantId: p.variantId, qty: 1 } });
                }}
                addPending={addCartItem.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </ShopPage>
  );
}
