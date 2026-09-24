import { useMemo, useRef } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { RAIL_DEPARTMENT_ORDER } from "@/lib/catalog-nav";
import type { StoreCategory } from "@/lib/products";

const ART: Record<string, string> = {
  "phones-electronics": "/images/categories/market-rail/electronics-v1.webp",
  "fashion-apparel": "/images/categories/market-rail/fashion-v1.webp",
  "home-living": "/images/categories/market-rail/home-v1.webp",
  "health-beauty": "/images/categories/market-rail/beauty-v1.webp",
  "baby-kids": "/images/categories/market-rail/baby-v1.webp",
  "food-groceries": "/images/categories/market-rail/groceries-v1.webp",
  beverages: "/images/categories/market-rail/beverages-v1.webp",
  "pet-care": "/images/categories/market-rail/pets-v1.webp",
  agriculture: "/images/categories/market-rail/agriculture-v1.webp",
  automotive: "/images/categories/market-rail/automotive-v1.webp",
  services: "/images/categories/market-rail/services-v1.webp",
  other: "/images/categories/market-rail/other-v1.webp",
};

export function HomeCategoryRail({
  categories,
}: {
  categories: StoreCategory[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => {
    const byHandle = new Map(
      categories
        .filter((c) => c.handle)
        .map((c) => [c.handle!.toLowerCase(), c]),
    );
    return RAIL_DEPARTMENT_ORDER.map((handle) => byHandle.get(handle))
      .filter((c): c is StoreCategory =>
        Boolean(c && ART[c.handle!.toLowerCase()]),
      )
      .slice(0, 12);
  }, [categories]);
  if (!shown.length) return null;
  const move = (direction: -1 | 1) =>
    railRef.current?.scrollBy({ left: direction * 720, behavior: "smooth" });

  return (
    <section aria-labelledby="market-categories-title" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            id="market-categories-title"
            className="mt-1 text-2xl font-black tracking-tight sm:text-3xl"
          >
            Shop by category
          </h2>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label="Scroll categories left"
            onClick={() => move(-1)}
            className="flex size-11 items-center justify-center rounded-full border bg-card hover:bg-muted"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Scroll categories right"
            onClick={() => move(1)}
            className="flex size-11 items-center justify-center rounded-full border bg-card hover:bg-muted"
          >
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </div>
      <div
        ref={railRef}
        className="scrollbar-none flex snap-x gap-3 overflow-x-auto pb-2"
      >
        {shown.map((category) => (
          <Link
            key={category.id}
            to="/categories/$slug"
            params={{ slug: category.handle || category.id }}
            className="group w-40 shrink-0 snap-start sm:w-44"
          >
            <div className="overflow-hidden rounded-lg bg-muted">
              <img
                src={ART[category.handle!.toLowerCase()]}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <h3 className="text-sm font-extrabold leading-tight group-hover:underline">
                {category.name}
              </h3>
              <span aria-hidden="true" className="text-primary">
                ↗
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
