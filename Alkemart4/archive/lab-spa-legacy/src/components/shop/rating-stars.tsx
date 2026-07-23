import { StarFilledIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** Required for a real rating display. Omit or pass undefined for no rating yet. */
  rating?: number | null;
  count?: number | string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Rating row — filled stars use brand yellow (accent).
 * No invented default score: without a rating, shows an empty state.
 */
export function RatingStars({ rating, count, size = "sm", className }: RatingStarsProps) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const hasRating = typeof rating === "number" && !Number.isNaN(rating) && rating > 0;
  const full = hasRating ? Math.floor(rating) : 0;

  if (!hasRating) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className="flex items-center gap-px" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <StarFilledIcon key={i} className={cn(dim, "text-border")} />
          ))}
        </div>
        {count !== undefined && count !== "" && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">({count})</span>
        )}
        {count === undefined && (
          <span className="text-xs text-muted-foreground">No ratings yet</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`Rated ${rating} out of 5`}
    >
      <div className="flex items-center gap-px" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarFilledIcon
            key={i}
            className={cn(dim, i < full ? "text-accent" : "text-border")}
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs font-medium text-link tabular-nums">({count})</span>
      )}
    </div>
  );
}
