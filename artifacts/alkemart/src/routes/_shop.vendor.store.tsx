import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetVendorShop,
  useListVendorProducts,
  useListMyImages,
  getGetVendorShopQueryKey,
  getListMyImagesQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/shop/rating-stars";
import { ImageUploader } from "@/components/shop/image-uploader";
import { VendorShell } from "@/components/vendor/vendor-nav";

export const Route = createFileRoute("/_shop/vendor/store")({
  head: () => ({
    meta: [{ title: "Store profile — Vendor dashboard — alkemart Ghana" }],
  }),
  component: VendorStorePage,
});

function statusBadgeVariant(status: string): "secondary" | "outline" | "destructive" {
  if (status === "approved") return "secondary";
  if (status === "rejected") return "destructive";
  return "outline";
}

function targetLabel(targetType: string, products: Product[], targetId: number | null): string {
  if (targetType === "vendor_logo") return "Store logo";
  if (targetType === "vendor_banner") return "Store banner";
  if (targetType === "product") {
    const product = products.find((p) => p.id === targetId);
    return product ? `Product: ${product.title}` : `Product #${targetId}`;
  }
  return targetType;
}

function MyUploadsPanel({ products }: { products: Product[] }) {
  const { data, isLoading } = useListMyImages();
  const items = data?.items ?? [];

  if (isLoading || items.length === 0) return null;

  return (
    <div className="rounded-md border border-border p-6">
      <h2 className="font-display text-lg font-bold">Your uploads</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Status of images you've uploaded, including moderation outcomes from our admin team.
      </p>
      <div className="mt-4 space-y-2">
        {items.map((image) => (
          <div
            key={image.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
          >
            <div>
              <div className="font-medium">{targetLabel(image.targetType, products, image.targetId ?? null)}</div>
              {image.status === "rejected" && image.rejectionReason && (
                <div className="mt-0.5 text-xs text-destructive">Reason: {image.rejectionReason}</div>
              )}
            </div>
            <Badge variant={statusBadgeVariant(image.status)} className="capitalize">
              {image.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function VendorStorePage() {
  const queryClient = useQueryClient();
  const { data: vendor, isLoading: vendorLoading } = useGetVendorShop();
  const { data: productData } = useListVendorProducts();
  const products = productData?.items ?? [];

  return (
    <VendorShell title="Store profile" description="Your public storefront details, logo and banner.">
      <div className="space-y-6">
        <div className="rounded-md border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold">
                {vendorLoading ? "Loading…" : vendor?.name ?? "Your store"}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {vendor && (
                  <RatingStars
                    rating={vendor.ratingCount > 0 ? vendor.ratingAvgX100 / 100 : 0}
                    count={`${vendor.ratingCount} reviews`}
                  />
                )}
                {vendor?.badgeTopSeller && <Badge variant="secondary">Top seller</Badge>}
                {vendor?.badgeFastShipper && <Badge variant="secondary">Fast shipper</Badge>}
              </div>
            </div>
          </div>

          {vendor && (
            <div className="mt-6 flex flex-wrap gap-8 border-t border-border pt-6">
              <ImageUploader
                targetType="vendor_logo"
                targetId={vendor.id}
                currentImageUrl={vendor.logoImageUrl}
                label="Store logo"
                onUploaded={() => {
                  queryClient.invalidateQueries({ queryKey: getGetVendorShopQueryKey() });
                  queryClient.invalidateQueries({ queryKey: getListMyImagesQueryKey() });
                }}
              />
              <ImageUploader
                targetType="vendor_banner"
                targetId={vendor.id}
                currentImageUrl={vendor.bannerImageUrl}
                label="Store banner"
                ratio={16 / 9}
                onUploaded={() => {
                  queryClient.invalidateQueries({ queryKey: getGetVendorShopQueryKey() });
                  queryClient.invalidateQueries({ queryKey: getListMyImagesQueryKey() });
                }}
              />
            </div>
          )}
        </div>

        <MyUploadsPanel products={products} />
      </div>
    </VendorShell>
  );
}
