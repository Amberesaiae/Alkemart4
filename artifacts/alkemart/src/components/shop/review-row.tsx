import { ImageSlot } from "./image-slot";
import { RatingStars } from "./rating-stars";
import { TextSkeleton } from "./text-skeleton";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";

interface ReviewRowProps {
  rating?: number;
  title?: string;
  verified?: boolean;
  photoCount?: number;
  className?: string;
}

export function ReviewRow({
  rating = 5,
  title = "Great value for the price",
  verified = true,
  photoCount = 2,
  className,
}: ReviewRowProps) {
  return (
    <div className={cn("border-b border-border pb-6 last:border-0", className)}>
      <div className="flex items-center gap-3">
        <UserAvatar size="sm" name="Ama K." />
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <RatingStars rating={rating} />
            {verified && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-success">
                Verified purchase
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Ama K. · Accra</div>
        </div>
      </div>
      <div className="mt-3 text-sm font-bold">{title}</div>
      <TextSkeleton className="mt-2" lines={3} widths={["100%", "95%", "50%"]} />
      {photoCount > 0 && (
        <div className="mt-3 flex gap-2">
          {Array.from({ length: photoCount }).map((_, i) => (
            <div key={i} className="w-16">
              <ImageSlot ratio={1} rounded="md" tone="default" />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-4 text-xs">
        <button className="font-semibold text-primary underline">Helpful</button>
        <button className="font-semibold text-primary underline">Report</button>
      </div>
    </div>
  );
}
