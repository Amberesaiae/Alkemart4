import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tagVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 h-5 text-[11px] font-bold leading-none",
  {
    variants: {
      variant: {
        /* Black / white / yellow deal pills */
        rollback: "bg-accent text-accent-foreground",
        clearance: "bg-destructive text-destructive-foreground",
        best: "bg-primary text-primary-foreground",
        popular: "bg-secondary text-secondary-foreground border border-border",
        new: "bg-accent text-accent-foreground",
        outline: "border border-border bg-card text-foreground",
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
