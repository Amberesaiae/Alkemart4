import { Package } from "@phosphor-icons/react"
import { Price } from "@workspace/ui"
import { pesewasToMajor, type PreviewProduct } from "./preview-data"

/**
 * Read-only product card for the studio canvas: photo, category line,
 * title, seller and price — the facts an admin checks when merchandising
 * a shelf, without shop actions (no cart, no links; clicking a layer
 * selects it for editing instead of navigating anywhere).
 */
export function StudioProductCard({ product }: { product: PreviewProduct }) {
  const low = product.availableQty > 0 && product.availableQty <= 5
  const out = product.availableQty <= 0
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-square bg-tone-neutral-soft">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground" aria-hidden="true">
            <Package className="h-8 w-8" />
          </span>
        )}
        {out ? (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-tone-neutral px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tone-neutral-fg">
            Sold out
          </span>
        ) : low ? (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-tone-warning px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tone-warning-fg">
            Low stock
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {product.categoryName}
        </p>
        <p className="line-clamp-2 min-h-8 text-xs font-semibold leading-snug">
          {product.title}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {product.sellerName}
        </p>
        <Price amount={pesewasToMajor(product.fromPricePesewas)} currency="GHS" size="sm" className="font-extrabold text-[#FF3B30] dark:text-red-400" />
      </div>
    </div>
  )
}
