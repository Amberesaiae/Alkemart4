import { BookmarkIcon, BookmarkFilledIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/hooks/use-wishlist";

interface BookmarkToggleProps {
  id?: number | string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Canonical "save for later" control used on product cards, the product
 * detail page, and anywhere else a shopper can bookmark an item. Fully
 * clickable/keyboard-accessible with a pressed state, replacing the old
 * decorative, non-functional heart icon.
 */
export function BookmarkToggle({ id, className, size = "md" }: BookmarkToggleProps) {
  const { saved, toggle } = useWishlist(id);
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconDim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved items" : "Save for later"}
      aria-pressed={saved}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }}
      className={cn(
        "flex items-center justify-center rounded-full bg-background/95 shadow-sm ring-1 ring-border transition-all hover:scale-105 hover:text-primary active:scale-95",
        saved ? "text-primary ring-primary/40" : "text-muted-foreground",
        dim,
        className,
      )}
    >
      {saved ? <BookmarkFilledIcon className={iconDim} /> : <BookmarkIcon className={iconDim} />}
    </button>
  );
}
