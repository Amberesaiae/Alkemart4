import { ImageSlot } from "./image-slot";
import { DealTag } from "./deal-tag";
import { PriceCents } from "./price-cents";
import { cn } from "@/lib/utils";
import { pesewasToPrice } from "@/lib/money";
import { MerchLink } from "@/lib/nav-link";
import type { RailProduct } from "./product-rail";
import { Link } from "@tanstack/react-router";

interface MiniDealsColumnProps {
  title: string;
  tone?: "surface" | "muted" | "secondary";
  tag?: "rollback" | "clearance" | "best" | "popular" | "new";
  imageTone?: "default" | "brand" | "accent";
  className?: string;
  /** Real products for this deal tag. Undefined = still loading. */
  products?: RailProduct[];
}

const toneMap = {
  surface: "bg-surface",
  muted: "bg-muted",
  secondary: "bg-secondary/10",
};

const dealTagLabels: Record<NonNullable<MiniDealsColumnProps["tag"]>, string> = {
  rollback: "Rollback",
  clearance: "Clearance",
  best: "Best seller",
  popular: "Popular",
  new: "New",
};

/**
 * Mini-deals column — real products only (loading skeleton or empty).
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
  const items = products ?? [];

  return (
    <div className={cn("min-h-[280px] rounded-2xl p-5", toneMap[tone], className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold leading-tight">{title}</h3>
        <MerchLink
          to={`/browse/all`}
          className="shrink-0 text-[11px] font-semibold text-link underline underline-offset-2"
        >
          View all
        </MerchLink>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5" aria-hidden>
              <div className="aspect-square animate-pulse rounded-lg bg-card/60" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-card/60" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No deals in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {items.slice(0, 4).map((p) => (
            <Link
              key={p.id}
              to="/ip/$id"
              params={{ id: String(p.id) }}
              className="block space-y-1.5"
            >
              <div className="relative">
                <ImageSlot ratio={1} rounded="lg" tone={imageTone} src={p.imageUrl} alt={p.title} />
                <div className="absolute left-1.5 top-1.5">
                  <DealTag variant={tag}>{dealTagLabels[tag]}</DealTag>
                </div>
              </div>
              <PriceCents now={pesewasToPrice(p.pricePesewas)} size="sm" />
              <div className="line-clamp-2 text-xs font-medium leading-snug">{p.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
