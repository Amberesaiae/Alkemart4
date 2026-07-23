import { useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { ProductCard } from "./product-card";
import { ProductCardSkeleton } from "./product-card-skeleton";
import { cn } from "@/lib/utils";
import { gridColsClass, gridColsStyle } from "@/lib/grid-cols";
import { pesewasToPrice } from "@/lib/money";
import { useAddCartItem } from "@/lib/hooks-cart";

export type RailProduct = {
  id: string;
  /** First purchasable variant — required for vanilla Medusa add-to-cart. */
  variantId?: string;
  /** Mercur offer id — preferred for multi-vendor cart lines. */
  offerId?: string | null;
  title: string;
  brand?: string;
  tag?: string | null;
  pricePesewas: number;
  compareAtPesewas?: number;
  ratingAvgX100: number;
  ratingCount: number;
  imageUrl: string;
  vendorName?: string | null;
  vendorSlug?: string | null;
  stock?: number | null;
};

interface ProductRailProps {
  count?: number;
  columns?: number;
  variant?: "rail" | "grid";
  tag?: "rollback" | "clearance" | "best" | "popular" | "new";
  showAdd?: boolean;
  className?: string;
  products?: RailProduct[];
  /**
   * True while real product data is still being fetched. Renders inert
   * skeleton blocks instead of interactive fake product cards.
   */
  loading?: boolean;
  /** Message when not loading and no products (never invent prices). */
  emptyLabel?: string;
}

/**
 * Product rail — API data or honest empty/skeleton only.
 * Demo seed products are NOT rendered in production UI.
 */
export function ProductRail({
  count = 6,
  columns = 6,
  variant = "grid",
  showAdd = false,
  className,
  products,
  loading = false,
  emptyLabel = "No products to show yet.",
}: ProductRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };
  const queryClient = useQueryClient();
  const addCartItem = useAddCartItem();

  const items = (products ?? []).map((p) => {
    // Accept either flat vendorName or nested vendor from list API.
    const nested = (p as RailProduct & {
      vendor?: { name?: string; slug?: string } | null
      variantId?: string
      offerId?: string | null
    }).vendor
    const raw = p as RailProduct & {
      vendor?: { name?: string; slug?: string } | null
      variantId?: string
      offerId?: string | null
    }
    return {
      ...p,
      variantId: p.variantId ?? raw.variantId,
      offerId: p.offerId ?? raw.offerId ?? null,
      vendorName: p.vendorName ?? nested?.name ?? null,
      vendorSlug: p.vendorSlug ?? nested?.slug ?? null,
    }
  })
  const showEmpty = !loading && items.length === 0;

  const renderSkeletonCard = (i: number) => (
    <ProductCardSkeleton key={i} />
  );

  const renderCard = (p: RailProduct) => (
    <ProductCard
      key={p.id}
      id={p.id}
      title={p.title}
      brand={p.brand}
      vendorName={p.vendorName}
      vendorSlug={p.vendorSlug}
      tag={(p.tag as "rollback" | "clearance" | "best" | "popular" | "new" | null) ?? undefined}
      now={pesewasToPrice(p.pricePesewas)}
      was={p.compareAtPesewas ? pesewasToPrice(p.compareAtPesewas) : undefined}
      rating={p.ratingCount > 0 ? p.ratingAvgX100 / 100 : undefined}
      reviews={p.ratingCount > 0 ? p.ratingCount : undefined}
      stock={p.stock ?? undefined}
      imageUrl={p.imageUrl}
      showAdd={showAdd}
      showOptions={!showAdd}
      showShipping
      shippingLabel="Delivery options at checkout"
      onAdd={() => {
        if (!p.offerId && !p.variantId) {
          console.error("Product has no purchasable offer/variant", p.id);
          return;
        }
        addCartItem.mutate({
          data: { offerId: p.offerId, variantId: p.variantId, qty: 1 },
        });
      }}
      addPending={addCartItem.isPending}
    />
  );

  if (showEmpty) {
    return (
      <div
        className={cn(
          "flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div
        className={cn("grid items-stretch gap-3 md:gap-4", gridColsClass(columns), className)}
        style={gridColsStyle(columns)}
      >
        {loading
          ? Array.from({ length: count }).map((_, i) => renderSkeletonCard(i))
          : items.map((p) => renderCard(p))}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div ref={scrollerRef} className="no-scrollbar flex gap-3 overflow-x-auto pb-2 md:gap-4">
        {loading
          ? Array.from({ length: count }).map((_, i) => (
              <div key={i} className="w-[200px] shrink-0 md:w-[220px]">
                {renderSkeletonCard(i)}
              </div>
            ))
          : items.map((p) => (
              <div key={p.id} className="w-[200px] shrink-0 md:w-[220px]">
                {renderCard(p)}
              </div>
            ))}
      </div>
      {!loading && items.length > 0 && (
        <>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(320)}
            className="absolute -right-1 top-[88px] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-muted md:-right-2"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-320)}
            className="absolute -left-1 top-[88px] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-muted md:-left-2"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
