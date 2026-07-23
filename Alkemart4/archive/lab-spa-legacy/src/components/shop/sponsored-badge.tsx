import { cn } from "@/lib/utils";

export function SponsoredBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      Sponsored
    </span>
  );
}
