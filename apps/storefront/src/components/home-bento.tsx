import { Link } from "@tanstack/react-router"
import { Price } from "@/components/price"
import { IconChevronRight } from "@/components/icons"
import type { StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"

/**
 * Bento plan (desktop 12-col, collapses on mobile):
 *
 * ┌──────────────────┬────────┬────────┐
 * │  Hero product    │  P1    │  P2    │  ← live product media
 * │  (span 2 rows)   ├────────┼────────┤
 * │                  │ Dept A │ Seller │  ← API categories / sellers
 * ├────────┬─────────┴───┬────┴────────┤
 * │  P3    │    P4       │    P5       │  ← more products
 * └────────┴─────────────┴─────────────┘
 *
 * Rules: only tiles with real API data. Empty slots omitted — no placeholders inventing catalog.
 */

export type BentoSeller = { name: string; slug: string }
export type BentoCategory = { id: string; name: string; handle?: string | null }

type HomeBentoProps = {
  products: StoreProductCard[]
  categories: BentoCategory[]
  sellers: BentoSeller[]
}

function productHref(p: StoreProductCard) {
  return p.handle?.trim() || p.id
}

export function HomeBento({ products, categories, sellers }: HomeBentoProps) {
  const withImage = products.filter((p) => p.thumbnail)
  const pool = withImage.length >= 3 ? withImage : products

  const hero = pool[0]
  const p1 = pool[1]
  const p2 = pool[2]
  const p3 = pool[3]
  const p4 = pool[4]
  const p5 = pool[5]

  const catA = categories[0]
  const catB = categories[1]
  const seller = sellers[0]

  if (!hero) return null

  return (
    <section aria-label="Featured" className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight sm:text-lg">
          Featured
        </h2>
        <Link
          to="/browse/$slug"
          params={{ slug: "all" }}
          className="text-sm font-semibold underline-offset-2 hover:underline"
        >
          Shop all
        </Link>
      </div>

      {/*
        Mobile: single column stack
        md+: CSS grid bento
        grid-rows auto, hero spans 2 rows on left
      */}
      <div
        className={cn(
          "grid gap-2",
          "grid-cols-1",
          "md:grid-cols-4 md:grid-rows-[minmax(140px,1fr)_minmax(140px,1fr)_auto]",
        )}
      >
        {/* Hero — 2×2 on md */}
        <ProductTile
          product={hero}
          size="hero"
          className="md:col-span-2 md:row-span-2 min-h-[220px] md:min-h-0"
        />

        {p1 ? (
          <ProductTile product={p1} size="md" className="md:col-span-1 min-h-[140px]" />
        ) : null}
        {p2 ? (
          <ProductTile product={p2} size="md" className="md:col-span-1 min-h-[140px]" />
        ) : null}

        {/* Mix: category + seller or more products */}
        {catA ? (
          <CategoryTile
            category={catA}
            className="md:col-span-1 min-h-[120px]"
          />
        ) : p3 ? (
          <ProductTile product={p3} size="sm" className="md:col-span-1 min-h-[120px]" />
        ) : null}

        {seller ? (
          <SellerTile seller={seller} className="md:col-span-1 min-h-[120px]" />
        ) : catB ? (
          <CategoryTile
            category={catB}
            className="md:col-span-1 min-h-[120px]"
          />
        ) : null}

        {/* Bottom row — three products */}
        {p3 && catA ? (
          <ProductTile product={p3} size="sm" className="md:col-span-1 min-h-[160px]" />
        ) : null}
        {p4 ? (
          <ProductTile
            product={p4}
            size="sm"
            className={cn(
              "min-h-[160px]",
              p3 && catA ? "md:col-span-1" : "md:col-span-2",
            )}
          />
        ) : null}
        {p5 ? (
          <ProductTile
            product={p5}
            size="sm"
            className={cn(
              "min-h-[160px]",
              p3 && catA ? "md:col-span-2" : "md:col-span-1",
            )}
          />
        ) : null}
      </div>
    </section>
  )
}

function ProductTile(props: {
  product: StoreProductCard
  size: "hero" | "md" | "sm"
  className?: string
}) {
  const { product: p, size, className } = props
  const isHero = size === "hero"

  return (
    <Link
      to="/product/$id"
      params={{ id: productHref(p) }}
      className={cn(
        "group relative flex flex-col justify-end overflow-hidden border border-border bg-muted",
        className,
      )}
    >
      {p.thumbnail ? (
        <img
          src={p.thumbnail}
          alt=""
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]",
          )}
          loading={isHero ? "eager" : "lazy"}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/60" />
      )}
      <div
        className={cn(
          "absolute inset-0",
          isHero
            ? "bg-gradient-to-t from-black/80 via-black/25 to-transparent"
            : "bg-gradient-to-t from-black/75 via-black/10 to-transparent",
        )}
      />
      <div
        className={cn(
          "relative z-[1] space-y-1 text-white",
          isHero ? "p-4 sm:p-5" : "p-3",
        )}
      >
        {p.seller?.name ? (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
            {p.seller.name}
          </p>
        ) : null}
        <p
          className={cn(
            "font-bold leading-snug",
            isHero
              ? "line-clamp-2 text-lg sm:text-xl md:text-2xl"
              : size === "md"
                ? "line-clamp-2 text-sm"
                : "line-clamp-2 text-xs sm:text-sm",
          )}
        >
          {p.title}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Price
            amount={p.amount}
            currencyCode={p.currencyCode}
            size={isHero ? "md" : "sm"}
            className="font-bold text-white"
          />
          {isHero ? (
            <span className="inline-flex items-center gap-0.5 bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
              View
              <IconChevronRight className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function CategoryTile(props: {
  category: BentoCategory
  className?: string
}) {
  const slug = props.category.handle || props.category.id
  return (
    <Link
      to="/browse/$slug"
      params={{ slug }}
      className={cn(
        "group flex flex-col justify-between border border-border bg-card p-4 transition hover:border-foreground",
        props.className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Department
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-base font-bold leading-snug sm:text-lg">
          {props.category.name}
        </p>
        <IconChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground"
          aria-hidden
        />
      </div>
    </Link>
  )
}

function SellerTile(props: { seller: BentoSeller; className?: string }) {
  return (
    <Link
      to="/store/$slug"
      params={{ slug: props.seller.slug }}
      className={cn(
        "group flex flex-col justify-between border border-border bg-foreground p-4 text-background transition hover:opacity-95",
        props.className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-background/60">
        Seller
      </p>
      <div className="flex items-end justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
            {props.seller.name.slice(0, 1).toUpperCase()}
          </span>
          <p className="truncate text-base font-bold leading-snug">
            {props.seller.name}
          </p>
        </div>
        <IconChevronRight
          className="h-4 w-4 shrink-0 text-background/70"
          aria-hidden
        />
      </div>
    </Link>
  )
}

/** Skeleton matching bento footprint while catalog loads. */
export function HomeBentoSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-2 md:grid-cols-4 md:grid-rows-[140px_140px_auto]"
      role="status"
      aria-label="Loading featured"
    >
      <div className="min-h-[220px] animate-pulse bg-muted md:col-span-2 md:row-span-2 md:min-h-0" />
      <div className="min-h-[140px] animate-pulse bg-muted" />
      <div className="min-h-[140px] animate-pulse bg-muted" />
      <div className="min-h-[120px] animate-pulse bg-muted" />
      <div className="min-h-[120px] animate-pulse bg-muted" />
      <div className="min-h-[160px] animate-pulse bg-muted md:col-span-1" />
      <div className="min-h-[160px] animate-pulse bg-muted md:col-span-1" />
      <div className="min-h-[160px] animate-pulse bg-muted md:col-span-2" />
    </div>
  )
}
