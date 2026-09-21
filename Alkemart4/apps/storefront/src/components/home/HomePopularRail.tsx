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
    <section aria-labelledby="popular-picks-title" className="overflow-hidden rounded-3xl bg-[#f3eee6] ring-1 ring-black/[0.06]">
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4 sm:px-7">
        <div>
          <h2
            id="popular-picks-title"
            className="text-2xl font-black tracking-tight sm:text-3xl"
          >
            Popular Picks
          </h2>
          <p className="mt-1 text-sm text-foreground/60">Products shoppers are returning to across the market.</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label="Scroll popular picks left"
            onClick={() => move(-1)}
            className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-white hover:bg-white/70"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Scroll popular picks right"
            onClick={() => move(1)}
            className="flex size-10 items-center justify-center rounded-full border border-black/10 bg-white hover:bg-white/70"
          >
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </div>
      <div
        ref={railRef}
        className="scrollbar-none flex snap-x gap-3 overflow-x-auto p-4 sm:p-6"
      >
        {products.slice(0, 8).map((product) => (
          <div key={product.id} className="w-48 shrink-0 snap-start sm:w-52">
            <ProductCard
              product={product}
              size="tile"
              hideSellerCount
              className="max-w-none bg-white"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
