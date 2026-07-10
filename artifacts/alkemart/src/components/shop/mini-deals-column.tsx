import { Link } from "@tanstack/react-router";
import { ImageSlot } from "./image-slot";
import { DealTag } from "./deal-tag";
import { PriceCents } from "./price-cents";
import { cn } from "@/lib/utils";
import type { Product } from "@workspace/api-client-react";

interface MiniDealsColumnProps {
  title: string;
  tone?: "surface" | "muted" | "secondary";
  tag?: "rollback" | "clearance" | "best" | "popular" | "new";
  imageTone?: "default" | "brand" | "accent";
  className?: string;
  /** Real products for this deal tag, fetched by the parent. Undefined = still loading. */
  products?: Product[];
}

const toneMap = {
  surface: "bg-surface",
  muted: "bg-muted",
  secondary: "bg-secondary/10",
};

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

const dealTagLabels: Record<NonNullable<MiniDealsColumnProps["tag"]>, string> = {
  rollback: "Rollback",
  clearance: "Clearance",
  best: "Best seller",
  popular: "Popular",
  new: "New",
};

/**
 * Flat single-container mini-deals column. No inner card chrome — tiles are
 * borderless and sit directly on the column surface. Backed by real products
 * tagged with this column's deal tag (fetched via GET /products?tag=...).
 */
export function MiniDealsColumn({
  title,
  tone = "muted",
  tag = "rollback",
  imageTone = "default",
  className,
  products,
}: MiniDealsColumnProps) {
  const isLoading = products === undefined;
  const items = products ?? Array.from({ length: 4 }).map(() => null);

  return (
    <div className={cn("rounded-2xl p-5 min-h-[460px]", toneMap[tone], className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="font-display text-sm font-bold leading-tight">{title}</h3>
        <Link
          to="/browse/$slug"
          params={{ slug: "search" }}
          search={{ search: "" }}
          className="shrink-0 text-[11px] font-semibold text-foreground underline underline-offset-2 hover:text-primary"
        >
          View all
        </Link>
      </div>
      {!isLoading && items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No deals in this category yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {items.slice(0, 4).map((p, i) => (
            <div key={p ? p.id : i} className="space-y-1.5">
              {p ? (
                <Link to="/ip/$id" params={{ id: String(p.id) }} className="block space-y-1.5">
                  <div className="relative">
                    <ImageSlot ratio={1} rounded="lg" tone={imageTone} src={p.imageUrl} alt={p.title} />
                    <div className="absolute left-1.5 top-1.5">
                      <DealTag variant={tag}>{dealTagLabels[tag]}</DealTag>
                    </div>
                  </div>
                  <PriceCents
                    now={pesewasToPrice(p.pricePesewas)}
                    was={p.compareAtPesewas ? pesewasToPrice(p.compareAtPesewas) : undefined}
                    label="Now"
                    size="sm"
                    emphasis="deal"
                  />
                </Link>
              ) : (
                <div className="space-y-1.5">
                  <div className="aspect-square animate-pulse rounded-lg bg-black/5" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-black/5" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
