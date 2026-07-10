import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ImageSlot } from "./image-slot";
import { PriceCents } from "./price-cents";
import { TextSkeleton } from "./text-skeleton";
import { DealTag } from "./deal-tag";
import { QtyStepper } from "./qty-stepper";
import { cn } from "@/lib/utils";

interface LineItemProps {
  loading?: boolean;
  title?: string;
  now?: string;
  was?: string;
  color?: string;
  qty?: number;
  showAddOns?: boolean;
  className?: string;
  onIncrease?: () => void;
  onDecrease?: () => void;
  onRemove?: () => void;
  qtyPending?: boolean;
}

export function LineItem({
  loading = false,
  title = "ASUS Chromebook CX15 Laptop, 15.6\" FHD Display, Intel® Processor N50, 128GB Storage",
  now = "199.00",
  was,
  color = "Forging Blue",
  qty = 1,
  showAddOns = true,
  className,
  onIncrease,
  onDecrease,
  onRemove,
  qtyPending = false,
}: LineItemProps) {
  if (loading) {
    return (
      <div className={cn("rounded-md border border-border bg-background animate-pulse", className)}>
        <div className="flex items-center gap-3 rounded-t-md bg-secondary/10 p-4">
          <div className="h-9 w-9 shrink-0 rounded-full bg-muted" />
          <div className="space-y-1">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[140px_1fr]">
          <div className="h-[140px] w-[140px] rounded bg-muted" />
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/4 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-border bg-background", className)}>
      <div className="flex items-center gap-3 rounded-t-md bg-secondary/60 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M3 6h13v9H3zm14 3h3l2 3v3h-2a2 2 0 1 1-4 0h-3V9h4Z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold">Free shipping, arrives Mon, Jul 6</div>
          <span className="text-xs font-semibold text-primary" aria-label="Tracking number 95829">
            95829
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-6 md:grid-cols-[140px_1fr]">
        <div>
          <ImageSlot ratio={1} rounded="lg" tone="brand" />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="text-xs text-muted-foreground">
            Sold and shipped by shopmark
            <span className="ml-2 font-semibold text-success">Free shipping</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <DealTag variant="popular">In 200+ people's carts</DealTag>
            <DealTag variant="best">Best seller</DealTag>
          </div>
          <PriceCents now={now} was={was} size="lg" />
          <div className="text-sm font-medium leading-snug line-clamp-2">{title}</div>
          <div className="text-xs text-muted-foreground">
            Actual color:{" "}
            <span className="font-semibold text-foreground">{color}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-primary">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary">
              <svg viewBox="0 0 24 24" className="h-3 w-3 fill-primary" aria-hidden="true">
                <path d="M12 2 2 7v5c0 5 4 9 10 10 6-1 10-5 10-10V7L12 2Z" />
              </svg>
            </span>
            Free 30-day returns
          </div>

          {showAddOns && (
            <>
              <Separator className="my-2" />
              <div>
                <div className="mb-2 text-sm font-bold">Accident Plan by Allstate</div>
                <div className="space-y-2">
                  {[
                    { label: "2-Year Plan", price: "GH₵44.00" },
                    { label: "3-Year Plan", price: "GH₵58.00" },
                  ].map((p) => (
                    <label
                      key={p.label}
                      className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs"
                    >
                      <Checkbox id={`plan-${p.label}`} />
                      <span className="flex-1">{p.label}</span>
                      <span className="font-semibold">{p.price}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-bold">Tech support</div>
                <div className="space-y-2">
                  {[
                    { label: "1 Year Remote Tech Support + Setup", price: "GH₵58.00" },
                    { label: "Chromebook Setup & Support", price: "GH₵28.00" },
                  ].map((p) => (
                    <label
                      key={p.label}
                      className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs"
                    >
                      <Checkbox id={`ts-${p.label}`} />
                      <span className="flex-1">{p.label}</span>
                      <span className="font-semibold">{p.price}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator className="my-2" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4 text-xs">
              <button
                type="button"
                aria-label={`Remove ${title} from cart`}
                className="font-semibold text-primary underline"
                onClick={onRemove}
              >
                Remove
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Save for later isn't available yet"
                className="font-semibold text-muted-foreground underline decoration-dashed opacity-60 cursor-not-allowed"
              >
                Save for later (coming soon)
              </button>
            </div>
            <QtyStepper value={qty} onIncrease={onIncrease} onDecrease={onDecrease} disabled={qtyPending} />
          </div>
        </div>
      </div>
    </div>
  );
}
