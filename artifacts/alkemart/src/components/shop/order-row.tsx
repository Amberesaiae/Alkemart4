import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";

interface Props {
  id?: string | number;
  orderId?: string;
  date?: string;
  status?: "Delivered" | "In transit" | "Processing" | "Returned";
  total?: string;
  items?: number;
  currency?: string;
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
  orderId = "AKM-2026-0142",
  date = "Delivered Jun 28",
  status = "Delivered",
  total = "GH₵248.90",
  items = 3,
  className,
}: Props) {
  const detailId = String(id ?? orderId);
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
      <div className="mt-4 grid grid-cols-[repeat(3,72px)_1fr_auto] items-center gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <ImageSlot key={i} ratio={1} rounded="md" tone="brand" />
        ))}
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar size="sm" name="alkemart Accra" />
          <div className="min-w-0">
            <div className="font-semibold">{items} items</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Fulfilled by alkemart Accra
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/order/$id" params={{ id: detailId }}>
              Track
            </Link>
          </Button>
          <Button size="sm">Reorder</Button>
        </div>
      </div>
    </div>
  );
}
