import { cn } from "@/lib/utils";

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
  md: { now: "text-lg", was: "text-xs", cents: "text-xs" },
  lg: { now: "text-3xl", was: "text-sm", cents: "text-base" },
};

export function PriceBlock({
  now = "19",
  was,
  label,
  size = "md",
  className,
  emphasis = "default",
  currency = "GH₵",
}: PriceBlockProps) {
  const [dollars, cents = "00"] = now.split(".");
  const s = sizeMap[size];
  const color = emphasis === "deal" ? "text-success" : "text-foreground";
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className={cn("flex items-baseline gap-1 font-display font-bold", color)}>
        {label && <span className={cn(s.was, "font-semibold text-inherit")}>{label}</span>}
        <span className={cn(s.now, "leading-none tracking-tight")}>{currency}{dollars}</span>
        <span className={cn(s.cents, "leading-none")}>{cents}</span>
      </div>
      {was && (
        <span className="text-xs text-muted-foreground line-through">{currency}{was}</span>
      )}
    </div>
  );
}
