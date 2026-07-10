import { useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { useQueryClient } from "@tanstack/react-query";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";
import { gridColsClass, gridColsStyle } from "@/lib/grid-cols";
import { useAddCartItem, getGetCartQueryKey } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";

interface ProductRailProps {
  count?: number;
  columns?: number;
  variant?: "rail" | "grid";
  tag?: "rollback" | "clearance" | "best" | "popular" | "new";
  showAdd?: boolean;
  className?: string;
  products?: Product[];
  /**
   * True while real product data is still being fetched. Renders inert
   * skeleton blocks instead of interactive placeholder ProductCards, so a
   * shopper can never click a bookmark toggle on a "fake" card identity
   * that then gets swapped out for the real (differently-keyed) product
   * once the fetch resolves, which would silently lose their click.
   */
  loading?: boolean;
}

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

export function ProductRail({
  count = 6,
  columns = 6,
  variant = "grid",
  tag,
  showAdd = false,
  className,
  products,
  loading = false,
}: ProductRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };
  const queryClient = useQueryClient();
  const addCartItem = useAddCartItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
    },
  });

  const priceSeeds = ["14.00", "39.88", "672.00", "20.00", "10.97", "88.91", "127.00", "44.47"];
  const wasSeeds = ["27.00", "59.00", undefined, "27.00", "17.97", "99.99", undefined, "59.00"];

  const items = products ?? Array.from({ length: count }).map((_, i) => ({ __placeholder: i }));

  const renderSkeletonCard = (i: number) => (
    <div key={i} className="flex h-full flex-col gap-2">
      <div className="aspect-square animate-pulse rounded-xl bg-muted" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );

  const renderCard = (item: (typeof items)[number], i: number) => {
    if (products) {
      const p = item as Product;
      return (
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
          showAdd={showAdd}
          showOptions={!showAdd}
          onAdd={() => addCartItem.mutate({ data: { productId: p.id, qty: 1 } })}
          addPending={addCartItem.isPending}
        />
      );
    }

    return (
      <ProductCard
        key={i}
        tag={i % 3 === 0 ? tag ?? "rollback" : undefined}
        now={priceSeeds[i % priceSeeds.length]}
        was={wasSeeds[i % wasSeeds.length]}
        label={i % 4 === 0 ? "Now" : undefined}
        showAdd={showAdd}
        showOptions={!showAdd}
      />
    );
  };

  if (variant === "grid") {
    return (
      <div
        className={cn("grid items-stretch gap-4", gridColsClass(columns), className)}
        style={gridColsStyle(columns)}
      >
        {loading
          ? Array.from({ length: count }).map((_, i) => renderSkeletonCard(i))
          : items.map((item, i) => renderCard(item, i))}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div ref={scrollerRef} className="scrollbar-none flex gap-4 overflow-x-auto pb-2">
        {loading
          ? Array.from({ length: count }).map((_, i) => (
              <div key={i} className="w-[220px] shrink-0">
                {renderSkeletonCard(i)}
              </div>
            ))
          : items.map((item, i) => (
              <div key={products ? (item as Product).id : i} className="w-[220px] shrink-0">
                {renderCard(item, i)}
              </div>
            ))}
      </div>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollBy(320)}
        className="absolute -right-2 top-24 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-colors hover:bg-surface"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollBy(-320)}
        className="absolute -left-2 top-24 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-colors hover:bg-surface"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
