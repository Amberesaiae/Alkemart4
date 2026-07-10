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
  id?: number;
  title?: string;
  tag?: "rollback" | "clearance" | "best" | "popular" | "new";
  tagLabel?: string;
  now?: string;
  was?: string;
  label?: string;
  rating?: number;
  reviews?: number | string;
  variant?: "default" | "compact";
  emphasis?: "default" | "deal";
  showAdd?: boolean;
  showOptions?: boolean;
  showShipping?: boolean;
  imageTone?: "default" | "brand" | "accent";
  imageUrl?: string | null;
  className?: string;
  titleWidths?: string[];
  onAdd?: () => void;
  addPending?: boolean;
}

const tagLabels: Record<string, string> = {
  rollback: "Rollback",
  clearance: "Clearance",
  best: "Best seller",
  popular: "Popular pick",
  new: "New",
};

export function ProductCard({
  id,
  title,
  tag,
  tagLabel,
  now = "19",
  was,
  label,
  rating,
  reviews,
  variant = "default",
  emphasis = "default",
  showAdd = false,
  showOptions = true,
  showShipping = false,
  imageTone = "default",
  imageUrl,
  className,
  titleWidths,
  onAdd,
  addPending = false,
}: ProductCardProps) {
  const autoBookmarkId = useId();
  const bookmarkId = id ?? autoBookmarkId;
  const body = (
    <>
      <div className="relative overflow-hidden rounded-md">
        <ImageSlot
          ratio={1}
          rounded="md"
          tone={imageTone}
          src={imageUrl}
          alt={title}
          imgClassName="transition-transform duration-500 ease-out group-hover:scale-105"
        />
        {tag && (
          <div className="absolute left-2 top-2 z-10">
            <DealTag variant={tag}>{tagLabel ?? tagLabels[tag]}</DealTag>
          </div>
        )}
        <BookmarkToggle id={bookmarkId} size="sm" className="absolute right-2 top-2 z-10" />
      </div>

      <PriceBlock
        now={now}
        was={was}
        label={label}
        size={variant === "compact" ? "sm" : "md"}
        emphasis={emphasis}
      />

      {title ? (
        <div className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug">{title}</div>
      ) : (
        <TextSkeleton
          lines={2}
          widths={titleWidths ?? ["100%", "70%"]}
          className="mt-0.5"
        />
      )}

      {rating !== undefined && <RatingStars rating={rating} count={reviews} />}

      {showShipping && (
        <div className="text-[11px] text-muted-foreground">
          Free shipping, arrives in 2 days
        </div>
      )}
    </>
  );

  return (
    <div className={cn("group relative flex h-full flex-col gap-3 border border-border/60 bg-card p-4 rounded-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_36px_rgba(0,0,0,0.05)]", className)}>
      <div className="flex flex-1 flex-col gap-2">
        {id ? (
          <Link to="/ip/$id" params={{ id: String(id) }} className="flex flex-col gap-2">
            {body}
          </Link>
        ) : (
          body
        )}
      </div>

      <div className="mt-auto min-h-[36px]">
        {showAdd ? (
          <Button size="sm" className="w-full" onClick={onAdd} disabled={addPending}>
            <PlusIcon className="h-4 w-4" />
            Add
          </Button>
        ) : showOptions ? (
          id ? (
            <Button size="sm" variant="outline" className="w-fit" asChild>
              <Link to="/ip/$id" params={{ id: String(id) }}>
                Options
              </Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="w-fit">
              Options
            </Button>
          )
        ) : (
          <div aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
