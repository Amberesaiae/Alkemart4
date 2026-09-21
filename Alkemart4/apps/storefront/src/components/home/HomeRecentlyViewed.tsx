import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/product-card";
import type { StoreProductCard } from "@/lib/products";
import { readRecentlyViewed } from "@/lib/recently-viewed";

export function HomeRecentlyViewed({
  products,
}: {
  products: StoreProductCard[];
}) {
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(readRecentlyViewed()), []);

  const recent = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((product): product is StoreProductCard => Boolean(product))
      .slice(0, 6);
  }, [products, recentIds]);

  if (!recent.length) return null;

  return (
    <section aria-labelledby="recently-viewed-title" className="space-y-4">
      <div>
        <h2
          id="recently-viewed-title"
          className="text-xl font-black tracking-tight sm:text-2xl"
        >
          Recently viewed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off.
        </p>
      </div>
      <div className="scrollbar-none flex snap-x gap-3 overflow-x-auto pb-2">
        {recent.map((product) => (
          <div key={product.id} className="w-44 shrink-0 snap-start sm:w-52">
            <ProductCard product={product} size="tile" />
          </div>
        ))}
      </div>
    </section>
  );
}
