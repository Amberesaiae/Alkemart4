import { useRef } from "react";
import { ArrowRight, CaretLeft, CaretRight, MapPin, SealCheck } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { ProductCard } from "@/components/product-card";
import type { StoreProductCard } from "@/lib/products";
import { DEMO_VENDORS } from "@/components/home/StoreRail";

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
  if (!featured) return null;
  const [handle, shopProducts] = featured;
  const vendor = DEMO_VENDORS.find((shop) => shop.slug === handle);
  const name = shopProducts[0]?.seller?.name || vendor?.name || "Featured shop";
  const cover =
    vendor?.banner ||
    shopProducts[0]?.webUrl ||
    shopProducts[0]?.thumbnail ||
    "/images/categories/market-rail/fashion-v1.webp";

  const move = (direction: -1 | 1) =>
    railRef.current?.scrollBy({ left: direction * 560, behavior: "smooth" });

  return (
    <section aria-labelledby="featured-shop-title" className="overflow-hidden rounded-3xl border border-border bg-muted/35">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-7">
        <h2 id="featured-shop-title" className="text-2xl font-black tracking-tight sm:text-3xl">
          Featured Shop
        </h2>
        <div className="flex items-center gap-2">
          <Link to="/shops/$slug" params={{ slug: handle }} className="mr-2 hidden items-center gap-1 text-sm font-bold hover:text-primary sm:inline-flex">
            Visit shop <ArrowRight size={14} weight="bold" />
          </Link>
          <button type="button" aria-label="Scroll featured products left" onClick={() => move(-1)} className="flex size-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted">
            <CaretLeft size={18} weight="bold" />
          </button>
          <button type="button" aria-label="Scroll featured products right" onClick={() => move(1)} className="flex size-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted">
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Link to="/shops/$slug" params={{ slug: handle }} className="group relative min-h-72 overflow-hidden border-b border-border lg:min-h-[24rem] lg:border-b-0 lg:border-r">
          <img src={cover} alt={name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="relative flex h-full min-h-72 flex-col justify-between p-6 text-white lg:min-h-[24rem]">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground">
              <SealCheck size={14} weight="fill" /> Verified seller
            </span>
            <div>
              <h3 className="text-2xl font-black leading-tight">{name}</h3>
              {vendor?.location ? (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80">
                  <MapPin size={15} weight="fill" /> {vendor.location}
                </p>
              ) : null}
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-black text-primary">
                Enter shop <ArrowRight size={15} weight="bold" />
              </span>
            </div>
          </div>
        </Link>

        <div ref={railRef} className="scrollbar-none flex snap-x gap-3 overflow-x-auto p-4 sm:p-6">
          {shopProducts.slice(0, 6).map((product) => (
            <div key={product.id} className="w-48 shrink-0 snap-start sm:w-52">
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
      </div>
    </section>
  );
}
