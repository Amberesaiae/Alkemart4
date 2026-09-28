import { useRef } from "react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { ProductCard, ProductCardSkeleton } from "@/components/commerce/product-card"
import type { StoreProductCard } from "@/lib/products"
import { cn } from "@/lib/utils"

const GRID = "grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5"

export function ProductGrid({
  products,
  loading,
  skeletons = 10,
  className,
  pick,
}: {
  products: StoreProductCard[]
  loading?: boolean
  skeletons?: number
  className?: string
  /** ⚖ Compare mode: a pick button on each card. */
  pick?: { selected: string[]; full: boolean; toggle: (id: string) => void }
}) {
  return (
    <div className={cn(GRID, className)} aria-busy={loading || undefined}>
      {loading && products.length === 0
        ? Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p, i) =>
            pick ? (
              <div key={p.id} className="relative">
                <ProductCard product={p} priority={i < 4} />
                <PickButton product={p} pick={pick} />
              </div>
            ) : (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ),
          )}
    </div>
  )
}

function PickButton({ product, pick }: { product: StoreProductCard; pick: NonNullable<Parameters<typeof ProductGrid>[0]["pick"]> }) {
  const on = pick.selected.includes(product.id)
  const disabled = !on && pick.full
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${product.title} from compare` : `Add ${product.title} to compare`}
      disabled={disabled}
      onClick={() => pick.toggle(product.id)}
      className={cn(
        "absolute top-2 right-2 z-10 inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-bold shadow-sm transition-colors",
        on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-muted",
        disabled && "opacity-50",
      )}
    >
      {on ? <HugeiconsIcon icon={Tick02Icon} className="size-4" aria-hidden /> : null}
      {on ? "Picked" : "Compare"}
    </button>
  )
}

/** Horizontal shelf. Native scroll-snap on touch; arrow buttons on desktop. */
export function ProductRail({
  products,
  loading,
  label,
}: {
  products: StoreProductCard[]
  loading?: boolean
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" })
  const item = "w-[calc((100%-0.75rem)/2)] shrink-0 sm:w-[30%] lg:w-[22%] xl:w-[18.4%]"
  return (
    <div className="relative">
      <div ref={ref} className="rail -mx-4 scroll-px-4 px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0" role="list" aria-label={label}>
        {loading && products.length === 0
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={item} role="listitem">
                <ProductCardSkeleton />
              </div>
            ))
          : products.map((p, i) => (
              <div key={p.id} className={item} role="listitem">
                <ProductCard product={p} priority={i < 3} />
              </div>
            ))}
      </div>
      {products.length > 5 ? (
        <div className="pointer-events-none absolute inset-y-0 -right-3 -left-3 hidden items-start justify-between lg:flex lg:pt-[calc(11%-1.25rem)] xl:pt-[calc(9.2%-1.25rem)]">
          <Button
            variant="outline"
            size="icon-lg"
            className="pointer-events-auto bg-background shadow-md"
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <Button
            variant="outline"
            size="icon-lg"
            className="pointer-events-auto bg-background shadow-md"
            onClick={() => scroll(1)}
            aria-label="Scroll right"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
