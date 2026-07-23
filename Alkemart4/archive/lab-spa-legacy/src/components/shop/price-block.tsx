import { cn } from "@/lib/utils";
import { LIVE_CURRENCY_SYMBOL } from "@/lib/money";

interface PriceBlockProps {
  now?: string;
  was?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  emphasis?: "default" | "deal";
  currency?: string;
}

const sizeMap = {
  sm: { now: "text-base", was: "text-xs", cents: "text-[10px]" },
  md: { now: "text-xl", was: "text-xs", cents: "text-xs" },
  lg: { now: "text-3xl", was: "text-sm", cents: "text-sm" },
};

/**
 * Price-first hierarchy (Walmart): large bold now-price, small struck was-price.
 * Currency + dollars dominant; cents slightly elevated superscript-style.
 */
export function PriceBlock({
  now,
  was,
  label,
  size = "md",
  className,
  emphasis = "default",
  currency = LIVE_CURRENCY_SYMBOL,
}: PriceBlockProps) {
  const s = sizeMap[size];
  const color = emphasis === "deal" ? "text-success" : "text-price";

  if (now == null || now === "") {
    return (
      <div className={cn("h-6 w-20 animate-pulse rounded bg-muted", className)} aria-hidden />
    );
  }

  const [dollars, cents = "00"] = String(now).split(".");

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      <div className={cn("text-price flex items-start gap-0.5", color)}>
        {label && (
          <span className={cn(s.was, "mr-1 self-center font-semibold text-muted-foreground")}>
            {label}
          </span>
        )}
        <span className={cn(s.now, "leading-none")}>
          <span className="text-[0.65em] font-bold align-top">{currency}</span>
          {dollars}
        </span>
        <span className={cn(s.cents, "mt-0.5 font-bold leading-none")}>{cents}</span>
      </div>
      {was && (
        <span className={cn(s.was, "text-muted-foreground line-through")}>
          {currency}
          {was}
        </span>
      )}
    </div>
  );
}
