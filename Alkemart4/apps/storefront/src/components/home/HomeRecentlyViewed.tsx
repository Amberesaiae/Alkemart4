import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { StoreProductCard } from "@/lib/products";
import { readRecentlyViewed } from "@/lib/recently-viewed";

import { cn } from "@/lib/utils";

export function HomeRecentlyViewed({
  products,
  inCard = false,
  className,
}: {
  products: StoreProductCard[];
  inCard?: boolean;
  className?: string;
}) {
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(readRecentlyViewed()), []);

  const recent = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((product): product is StoreProductCard => Boolean(product))
      .slice(0, 8);
  }, [products, recentIds]);

  if (!recent.length) return null;

  return (
    <section
      aria-labelledby="recently-viewed-title"
      className={cn(
        inCard
          ? "w-full rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4"
          : "space-y-4",
        className,
      )}
    >
      <div className="flex items-baseline justify-between border-b border-border/50 pb-2.5">
        <div>
          <h2
            id="recently-viewed-title"
            className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
          >
            Recently viewed
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Pick up where you left off.
          </p>
        </div>
      </div>
      <div className="scrollbar-none flex snap-x gap-3 overflow-x-auto pb-1 sm:gap-4">
        {recent.map((product) => (
          <div key={product.id} className="w-[calc((100vw-3.25rem)/2)] max-w-[224px] shrink-0 snap-start sm:w-56">
            <ProductCard product={product} size="tile" />
          </div>
        ))}
      </div>
    </section>
  );
}
