import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CaretLeft, CaretRight, MapPin } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { ProductCard } from "@/components/product-card";
import type { StoreProductCard } from "@/lib/products";
import { listStoreVendors } from "@/lib/vendors";

export function HomeFeaturedShop({
  products,
}: {
  products: StoreProductCard[];
}) {
  const railRef = useRef<HTMLDivElement>(null);

  const grouped = new Map<string, StoreProductCard[]>();
  for (const product of products) {
    const handle = product.seller?.handle?.trim();
    if (!handle) continue;
    grouped.set(handle, [...(grouped.get(handle) ?? []), product]);
  }
  const featured = [...grouped.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0];
  // Hooks before any early return (Rules of Hooks): `featured` flips from
  // undefined to defined as products stream in, and a hook after the return
  // below crashes with React #310 on that .
  const vendorsQ = useQuery({
    queryKey: ["store", "vendors"],
    queryFn: () => listStoreVendors(),
    staleTime: 300_000,
  });
  if (!featured) return null;
  const [handle, shopProducts] = featured;
  // Real vendor record for banner/location; absent data omits, never fakes.
  const vendor = (vendorsQ.data ?? []).find((shop) => shop.slug === handle);
  const name = shopProducts[0]?.seller?.name || vendor?.name || "Featured shop";
  const cover =
    vendor?.banner ||
    shopProducts[0]?.webUrl ||
    shopProducts[0]?.thumbnail ||
    "/images/categories/market-rail/fashion-v1.webp";

  const move = (direction: -1 | 1) =>
    railRef.current?.scrollBy({ left: direction * 560, behavior: "smooth" });

  return (
    <section aria-labelledby="featured-shop-title" className="space-y-3.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="featured-shop-title" className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Featured Shop
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Independent shops delivering across Ghana.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/shops/$slug" params={{ slug: handle }} className="mr-2 hidden items-center gap-1 text-sm font-bold text-foreground hover:text-primary sm:inline-flex">
            Visit shop <ArrowRight size={14} weight="bold" />
          </Link>
          <button type="button" aria-label="Scroll featured products left" onClick={() => move(-1)} className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-card hover:bg-muted shadow-2xs">
            <CaretLeft size={18} weight="bold" />
          </button>
          <button type="button" aria-label="Scroll featured products right" onClick={() => move(1)} className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-card hover:bg-muted shadow-2xs">
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>

      <div ref={railRef} className="scrollbar-none flex snap-x gap-3 sm:gap-4 overflow-x-auto pb-2">
        {/* Leading Featured Shop Banner Tile */}
        <Link
          to="/shops/$slug"
          params={{ slug: handle }}
          className="group relative flex aspect-[16/10] w-72 sm:w-80 md:w-[22rem] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-lg ring-1 ring-black/[0.06] shadow-xs bg-muted"
        >
          <img
            src={cover}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <div className="relative z-10 p-3.5 sm:p-4">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-xs">
              Featured shop
            </span>
          </div>
          <div className="relative z-10 p-3.5 sm:p-4 text-white">
            <h3 className="text-base sm:text-lg font-bold leading-tight line-clamp-1">{name}</h3>
            {vendor?.location ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/80 line-clamp-1">
                <MapPin size={13} weight="fill" /> {vendor.location}
              </p>
            ) : null}
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:underline">
              Enter shop <ArrowRight size={12} weight="bold" />
            </span>
          </div>
        </Link>

        {/* Product Cards */}
        {shopProducts.slice(0, 6).map((product) => (
          <div
            key={product.id}
            className="w-[calc((100vw-3.25rem)/2)] max-w-[224px] shrink-0 snap-start sm:w-56"
          >
            <ProductCard
              product={product}
              size="tile"
              hideSeller
              hideSellerCount
              className="max-w-none"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
