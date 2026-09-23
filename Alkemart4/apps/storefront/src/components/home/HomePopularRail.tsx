import { useRef } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { ProductCard } from "@/components/product-card";
import type { StoreProductCard } from "@/lib/products";

export function HomePopularRail({
  products,
}: {
  products: StoreProductCard[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const move = (direction: -1 | 1) =>
    railRef.current?.scrollBy({ left: direction * 640, behavior: "smooth" });

  return (
    <section aria-labelledby="popular-picks-title" className="space-y-3.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2
            id="popular-picks-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
          >
            Popular Picks
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Products shoppers are returning to across the market.
          </p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label="Scroll popular picks left"
            onClick={() => move(-1)}
            className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-card hover:bg-muted transition-colors shadow-2xs"
          >
            <CaretLeft size={18} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Scroll popular picks right"
            onClick={() => move(1)}
            className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-card hover:bg-muted transition-colors shadow-2xs"
          >
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>
      <div
        ref={railRef}
        className="scrollbar-none flex snap-x gap-3 sm:gap-4 overflow-x-auto pb-2"
      >
        {products.slice(0, 8).map((product) => (
          <div
            key={product.id}
            className="w-[calc((100vw-3.25rem)/2)] max-w-[224px] shrink-0 snap-start sm:w-56"
          >
            <ProductCard
              product={product}
              size="tile"
              hideSellerCount
              className="max-w-none"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
