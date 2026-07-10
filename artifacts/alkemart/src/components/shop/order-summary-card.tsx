import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface OrderSummaryCardProps {
  itemCount?: number;
  subtotal?: string;
  discount?: string;
  discountLabel?: string;
  shipping?: string;
  taxes?: string;
  total?: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
  ctaDisabled?: boolean;
  installments?: boolean;
  className?: string;
}

export function OrderSummaryCard({
  itemCount = 1,
  subtotal = "GH₵241.50",
  discount,
  discountLabel = "Promo discount",
  shipping = "Free",
  taxes = "Calculated at checkout",
  total = "GH₵241.50",
  ctaLabel = "Continue to checkout",
  ctaTo,
  onCtaClick,
  ctaDisabled = false,
  installments = true,
  className,
}: OrderSummaryCardProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-md border border-border bg-background p-5">
        {ctaTo ? (
          ctaDisabled ? (
            <Button size="lg" className="w-full" disabled>
              {ctaLabel}
            </Button>
          ) : (
            <Button size="lg" className="w-full" asChild>
              <Link to={ctaTo}>{ctaLabel}</Link>
            </Button>
          )
        ) : (
          <Button size="lg" className="w-full" onClick={onCtaClick} disabled={ctaDisabled}>
            {ctaLabel}
          </Button>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          For the best shopping experience,{" "}
          <Link to="/signin" className="font-semibold text-primary underline">
            sign in
          </Link>
        </p>
        <Separator className="my-4" />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>
              Subtotal <span className="text-muted-foreground">({itemCount} item{itemCount === 1 ? "" : "s"})</span>
            </span>
            <span className="font-semibold">{subtotal}</span>
          </div>
          {discount && (
            <div className="flex justify-between">
              <span>{discountLabel}</span>
              <span className="font-semibold text-success">-{discount}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Delivery</span>
            <span className="font-semibold text-success">{shipping}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxes</span>
            <span className="text-muted-foreground">{taxes}</span>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold">Estimated total</span>
          <span className="font-display text-2xl font-bold">{total}</span>
        </div>
      </div>

      {installments && (
        <div className="rounded-md bg-foreground p-5 text-background">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">alkemart Pay Later</div>
              <div className="mt-1 text-xs opacity-70">Powered by MoMo</div>
              <div className="mt-3 text-sm">
                As low as <span className="font-bold">GH₵35/mo</span>
              </div>
              <div className="text-[11px] opacity-70">No credit impact to apply</div>
            </div>
            <Button variant="outline" size="sm" className="bg-background text-foreground">
              Learn more
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
