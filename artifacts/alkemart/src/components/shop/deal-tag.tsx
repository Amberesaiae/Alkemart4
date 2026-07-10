import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tagVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 h-6 text-[10px] font-bold uppercase tracking-wide",
  {
    variants: {
      variant: {
        rollback: "bg-accent text-accent-foreground",
        clearance: "bg-secondary text-secondary-foreground",
        best: "bg-foreground text-background",
        popular: "bg-muted text-foreground border border-border",
        new: "bg-success text-success-foreground",
        outline: "border border-border bg-background text-foreground",
      },
    },
    defaultVariants: { variant: "rollback" },
  },
);

interface DealTagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tagVariants> {}

export function DealTag({ className, variant, children, ...props }: DealTagProps) {
  return (
    <span className={cn(tagVariants({ variant }), className)} {...props}>
      {variant === "rollback" && (
        <svg viewBox="0 0 8 8" className="h-2 w-2 fill-current" aria-hidden="true">
          <path d="M4 8 0 2h8z" />
        </svg>
      )}
      {children}
    </span>
  );
}
