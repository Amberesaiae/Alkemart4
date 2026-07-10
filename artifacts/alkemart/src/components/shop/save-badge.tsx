import { cn } from "@/lib/utils";

interface SaveBadgeProps {
  amount: string;
  currency?: string;
  className?: string;
}

export function SaveBadge({ amount, currency = "GH₵", className }: SaveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-xs font-bold text-success",
        className,
      )}
    >
      You save {currency}
      {amount}
    </span>
  );
}
