import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface Props {
  id: string | number;
  orderId: string;
  date: string;
  status: "Delivered" | "In transit" | "Processing" | "Returned";
  total: string;
  items: number;
  /** Optional product titles for the row (no fake placeholders). */
  itemTitles?: string[];
  className?: string;
}

const statusTone: Record<string, string> = {
  Delivered: "bg-success/10 text-success",
  "In transit": "bg-primary/10 text-primary",
  Processing: "bg-accent/25 text-accent-foreground",
  Returned: "bg-destructive/10 text-destructive",
};

export function OrderRow({
  id,
  orderId,
  date,
  status,
  total,
  items,
  itemTitles = [],
  className,
}: Props) {
  const detailId = String(id);
  const thumbs = itemTitles.slice(0, 3);
  const thumbSlots = Math.min(3, Math.max(1, items || thumbs.length || 1));

  return (
    <div className={cn("rounded-md border border-border bg-background p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
              statusTone[status],
            )}
          >
            {status}
          </span>
          <span className="text-muted-foreground">{date}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
          <Link
            to="/order/$id"
            params={{ id: detailId }}
            className="font-semibold text-foreground hover:text-primary hover:underline"
          >
            Order # {orderId}
          </Link>
          <span>Total {total}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {Array.from({ length: thumbSlots }).map((_, i) => (
            <div key={i} className="w-[72px]">
              <ImageSlot
                ratio={1}
                rounded="md"
                tone="brand"
                alt={thumbs[i] ?? `Item ${i + 1}`}
              />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {items} item{items === 1 ? "" : "s"}
          </div>
          {thumbs[0] && (
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{thumbs[0]}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/order/$id" params={{ id: detailId }}>
              View order
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/browse/$slug" params={{ slug: "all" }}>
              Shop again
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
