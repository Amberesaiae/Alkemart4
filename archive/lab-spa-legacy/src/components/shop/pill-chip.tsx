import { cn } from "@/lib/utils";

interface PillChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "outline" | "filled";
}

export function PillChip({
  active,
  tone = "outline",
  className,
  children,
  ...props
}: PillChipProps) {
  const base =
    "whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition-colors";
  const styles =
    tone === "filled"
      ? active
        ? "bg-primary text-primary-foreground"
        : "bg-surface-strong text-foreground hover:bg-secondary"
      : active
        ? "border border-primary bg-primary/5 text-primary"
        : "border border-border bg-background text-foreground hover:border-primary hover:text-primary";
  return (
    <button type="button" className={cn(base, styles, className)} {...props}>
      {children}
    </button>
  );
}
