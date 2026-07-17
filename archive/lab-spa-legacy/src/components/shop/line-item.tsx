import { Separator } from "@/components/ui/separator";
import { ImageSlot } from "./image-slot";
import { PriceCents } from "./price-cents";
import { QtyStepper } from "./qty-stepper";
import { cn } from "@/lib/utils";

interface LineItemProps {
  loading?: boolean;
  title?: string;
  now?: string;
  was?: string;
  imageUrl?: string | null;
  vendorName?: string | null;
  qty?: number;
  className?: string;
  onIncrease?: () => void;
  onDecrease?: () => void;
  onRemove?: () => void;
  qtyPending?: boolean;
}

/**
 * Cart line — price → title → sold-by (Ghana marketplace hierarchy).
 */
export function LineItem({
  loading = false,
  title,
  now,
  was,
  imageUrl,
  vendorName,
  qty = 1,
  className,
  onIncrease,
  onDecrease,
  onRemove,
  qtyPending = false,
}: LineItemProps) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border border-border bg-card animate-pulse shadow-sm", className)}>
        <div className="grid gap-4 p-4 md:grid-cols-[120px_1fr] md:gap-6 md:p-5">
          <div className="aspect-square max-w-[120px] rounded-lg bg-muted" />
          <div className="space-y-3">
            <div className="h-6 w-24 rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="grid gap-4 p-4 md:grid-cols-[120px_1fr] md:gap-6 md:p-5">
        <div className="max-w-[120px]">
          <ImageSlot ratio={1} rounded="lg" tone="brand" src={imageUrl} alt={title} />
        </div>
        <div className="min-w-0 space-y-2">
          <PriceCents now={now} was={was} size="lg" />
          <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
            {title ?? "Product"}
          </div>
          {vendorName ? (
            <div className="text-xs text-muted-foreground">
              Sold by <span className="font-semibold text-foreground">{vendorName}</span>
            </div>
          ) : null}
          <div className="text-xs text-muted-foreground">
            Delivery options confirmed at checkout
          </div>

          <Separator className="my-2" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              aria-label={`Remove ${title ?? "item"} from cart`}
              className="text-xs font-semibold text-link hover:underline"
              onClick={onRemove}
            >
              Remove
            </button>
            <QtyStepper
              value={qty}
              onIncrease={onIncrease}
              onDecrease={onDecrease}
              disabled={qtyPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
