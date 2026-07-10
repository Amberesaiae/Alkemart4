import { Progress } from "@/components/ui/progress";
import { RatingStars } from "./rating-stars";
import { cn } from "@/lib/utils";

interface RatingHistogramProps {
  average?: number;
  total?: number | string;
  distribution?: number[]; // 5 → 1
  className?: string;
}

export function RatingHistogram({
  average = 4.3,
  total = 73,
  distribution = [64, 22, 8, 3, 3],
  className,
}: RatingHistogramProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="font-display text-5xl font-bold leading-none">
        {average.toFixed(1)}
        <span className="text-2xl text-muted-foreground"> / 5</span>
      </div>
      <RatingStars rating={average} size="md" />
      <div className="text-xs text-muted-foreground">Based on {total} customer reviews</div>
      <div className="space-y-1.5">
        {distribution.map((pct, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-right font-semibold">{5 - i}</span>
            <Progress value={pct} className="h-2 flex-1" />
            <span className="w-8 text-right text-muted-foreground tabular-nums">
              {pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
