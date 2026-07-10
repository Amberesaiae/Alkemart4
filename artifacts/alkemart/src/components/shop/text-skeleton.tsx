import { cn } from "@/lib/utils";

interface TextSkeletonProps {
  lines?: number;
  className?: string;
  widths?: string[];
}

export function TextSkeleton({ lines = 2, className, widths }: TextSkeletonProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-surface-strong"
          style={{ width: widths?.[i] ?? (i === lines - 1 ? "60%" : "100%") }}
        />
      ))}
    </div>
  );
}
