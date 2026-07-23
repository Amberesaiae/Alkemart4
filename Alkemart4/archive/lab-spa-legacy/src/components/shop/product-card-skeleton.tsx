import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Structure-only product card placeholder — never invents prices or titles.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-3",
        className,
      )}
      aria-hidden
    >
      <Skeleton className="aspect-square w-full rounded-md bg-muted" />
      <Skeleton className="h-5 w-1/2 bg-muted" />
      <Skeleton className="h-3 w-full bg-muted" />
      <Skeleton className="h-3 w-2/3 bg-muted" />
      <Skeleton className="mt-auto h-9 w-full rounded-full bg-muted" />
    </div>
  );
}

/** PLP / rail grid of card skeletons. */
export function ProductCardSkeletonGrid({
  count = 8,
  className,
  columnsClassName = "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
}: {
  count?: number;
  className?: string;
  columnsClassName?: string;
}) {
  return (
    <div
      className={cn("grid gap-3 md:gap-4", columnsClassName, className)}
      role="status"
      aria-label="Loading products"
    >
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
