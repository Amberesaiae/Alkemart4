import { cn } from "@/lib/utils";

interface PriceCentsProps {
  now?: string;
  was?: string;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
  emphasis?: "default" | "deal" | "muted";
  className?: string;
  perUnit?: string;
  currency?: string;
}

const sizeMap = {
  sm: { dollars: "text-sm", cents: "text-[10px]", label: "text-[10px]" },
  md: { dollars: "text-lg", cents: "text-[11px]", label: "text-xs" },
  lg: { dollars: "text-2xl", cents: "text-sm", label: "text-sm" },
  xl: { dollars: "text-4xl", cents: "text-lg", label: "text-base" },
};

const emphasisMap = {
  default: "text-foreground",
  deal: "text-success",
  muted: "text-muted-foreground",
};

/** Big currency integer with superscript cents. Default currency GH₵ (Ghana). */
export function PriceCents({
  now = "19.00",
  was,
  label,
  size = "md",
  emphasis = "default",
  className,
  perUnit,
  currency = "GH₵",
}: PriceCentsProps) {
  const [dollars, cents = "00"] = now.split(".");
  const s = sizeMap[size];
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className={cn("flex items-baseline gap-1 font-display font-bold", emphasisMap[emphasis])}>
        {label && (
          <span className={cn(s.label, "font-semibold uppercase tracking-wide")}>{label}</span>
        )}
        <span className={cn(s.dollars, "leading-none tracking-tight")}>
          {currency}
          {dollars}
        </span>
        <span className={cn(s.cents, "leading-none -translate-y-1")}>{cents}</span>
        {perUnit && (
          <span className="text-xs font-normal text-muted-foreground">{perUnit}</span>
        )}
      </div>
      {was && (
        <span className="text-xs text-muted-foreground line-through">
          {currency}
          {was}
        </span>
      )}
    </div>
  );
}
