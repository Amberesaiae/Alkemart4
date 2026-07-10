import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const etaVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        express: "bg-primary text-primary-foreground",
        shipping: "text-foreground",
        pickup: "text-foreground",
        arrives: "text-muted-foreground",
      },
    },
    defaultVariants: { variant: "arrives" },
  },
);

interface Props
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof etaVariants> {
  label?: string;
}

export function DeliveryEtaChip({ variant = "arrives", label, className, ...rest }: Props) {
  const text =
    label ??
    (variant === "express"
      ? "Delivery as soon as 13 mins"
      : variant === "shipping"
        ? "Shipping, arrives tomorrow"
        : variant === "pickup"
          ? "Pickup as soon as tomorrow"
          : "Arrives Mon, Jul 6");
  return (
    <span className={cn(etaVariants({ variant }), className)} {...rest}>
      {variant === "express" && (
        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
      )}
      {text}
    </span>
  );
}
