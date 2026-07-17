import { useId } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";
import { PriceBlock } from "./price-block";
import { DealTag } from "./deal-tag";
import { RatingStars } from "./rating-stars";
import { TextSkeleton } from "./text-skeleton";
import { BookmarkToggle } from "./bookmark-toggle";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  id?: string;
  title?: string;
  brand?: string | null;
  /** Multi-vendor trust line (seller store name). */
  vendorName?: string | null;
  vendorSlug?: string | null;
  tag?: "rollback" | "clearance" | "best" | "popular" | "new" | "deal";
  tagLabel?: string;
  /** Major units string e.g. "19.99" — required for real products; omit only while loading */
  now?: string;
  was?: string;
  label?: string;
  rating?: number;
  reviews?: number | string;
  /** Stock count when known; omit if API does not send it. */
  stock?: number | null;
  variant?: "default" | "compact";
  emphasis?: "default" | "deal";
  showAdd?: boolean;
  showOptions?: boolean;
  showShipping?: boolean;
  shippingLabel?: string;
  imageTone?: "default" | "brand" | "accent";
  imageUrl?: string | null;
  className?: string;
  titleWidths?: string[];
  onAdd?: () => void;
  addPending?: boolean;
}

const tagLabels: Record<string, string> = {
  rollback: "Deal",
  clearance: "Clearance",
  best: "Best seller",
  popular: "Popular",
  new: "New",
  deal: "Deal",
};

/**
 * Ghana marketplace tile hierarchy (colors unchanged):
 * image + badge → price → title → sold-by → rating/stock → delivery → add
 */
export function ProductCard({
  id,
  title,
  brand,
  vendorName,
  vendorSlug,
  tag,
  tagLabel,
  now,
  was,
  label,
  rating,
  reviews,
  stock,
  variant = "default",
  emphasis = "default",
  showAdd = false,
  showOptions = true,
  showShipping = false,
  shippingLabel = "Delivery options at checkout",
  imageTone = "default",
  imageUrl,
  className,
  titleWidths,
  onAdd,
  addPending = false,
}: ProductCardProps) {
  const autoBookmarkId = useId();
  const bookmarkId = id ?? autoBookmarkId;
  const outOfStock = stock != null && stock <= 0;
  const lowStock = stock != null && stock > 0 && stock <= 5;

  const soldByLine = vendorName ? (
    <div className="truncate text-xs leading-snug text-muted-foreground">
      Sold by{" "}
      {vendorSlug ? (
        <Link
          to="/store/$slug"
          params={{ slug: vendorSlug }}
          className="font-semibold text-foreground underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {vendorName}
        </Link>
      ) : (
        <span className="font-semibold text-foreground">{vendorName}</span>
      )}
    </div>
  ) : brand ? (
    <div className="truncate text-xs font-semibold text-muted-foreground">{brand}</div>
  ) : null;

  const stockLine =
    stock == null ? null : outOfStock ? (
      <div className="text-xs font-semibold text-destructive">Out of stock</div>
    ) : lowStock ? (
      <div className="text-xs font-semibold text-foreground">Only {stock} left</div>
    ) : (
      <div className="text-xs text-muted-foreground">In stock</div>
    );

  const body = (
    <>
      <div className="relative overflow-hidden rounded-md bg-muted/30">
        <ImageSlot
          ratio={1}
          rounded="md"
          tone={imageTone}
          src={imageUrl}
          alt={title}
          imgClassName="transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        />
        {tag && (
          <div className="absolute left-1.5 top-1.5 z-10">
            <DealTag variant={tag === "deal" ? "rollback" : tag}>
              {tagLabel ?? tagLabels[tag]}
            </DealTag>
          </div>
        )}
        <BookmarkToggle id={bookmarkId} size="sm" className="absolute right-1.5 top-1.5 z-10" />
      </div>

      {/* Price first after image */}
      <PriceBlock
        now={now}
        was={was}
        label={label}
        size={variant === "compact" ? "sm" : "md"}
        emphasis={emphasis}
        className="mt-0.5"
      />

      {title ? (
        <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-foreground">
          {title}
        </div>
      ) : (
        <TextSkeleton lines={2} widths={titleWidths ?? ["100%", "70%"]} />
      )}

      {soldByLine}

      {rating !== undefined ? (
        <RatingStars rating={rating} count={reviews} />
      ) : null}

      {stockLine}

      {showShipping ? (
        <div className="text-xs leading-snug text-muted-foreground">{shippingLabel}</div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-3",
        "transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-1.5">
        {id ? (
          <Link to="/ip/$id" params={{ id: String(id) }} className="flex flex-col gap-1.5 outline-none">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>

      {(showAdd || showOptions) && (
        <div className="mt-auto flex items-center gap-2 pt-1">
          {showAdd && (
            <Button
              size="sm"
              variant="default"
              className="h-9 flex-1 rounded-full text-sm font-bold shadow-none"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAdd?.();
              }}
              disabled={addPending || outOfStock}
            >
              <PlusIcon className="mr-1 h-4 w-4" />
              {outOfStock ? "Out of stock" : addPending ? "Adding…" : "Add"}
            </Button>
          )}
          {showOptions && !showAdd && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-full justify-start px-0 text-sm font-semibold text-link hover:bg-transparent hover:underline"
              asChild={Boolean(id)}
            >
              {id ? (
                <Link to="/ip/$id" params={{ id: String(id) }}>
                  View options
                </Link>
              ) : (
                <span>View options</span>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
