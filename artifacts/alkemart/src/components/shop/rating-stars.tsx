import { StarFilledIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  rating?: number;
  count?: number | string;
  size?: "sm" | "md";
  className?: string;
}

export function RatingStars({ rating = 4.5, count, size = "sm", className }: RatingStarsProps) {
  const dim = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarFilledIcon
            key={i}
            className={cn(dim, i < Math.floor(rating) ? "text-accent" : "text-border")}
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </div>
  );
}
