import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { zeroMoneyLabel } from "@/lib/money";

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
  /** Extra note under CTA (e.g. MoMo hint). */
  footerNote?: string;
  className?: string;
}

export function OrderSummaryCard({
  itemCount = 0,
  subtotal = zeroMoneyLabel(),
  discount,
  discountLabel = "Promo discount",
  shipping = "At checkout",
  taxes = "At checkout",
  total = zeroMoneyLabel(),
  ctaLabel = "Continue to checkout",
  ctaTo,
  onCtaClick,
  ctaDisabled = false,
  installments = false,
  footerNote,
  className,
}: OrderSummaryCardProps) {
  const shippingIsKnown =
    shipping !== "At checkout" &&
    shipping !== "Calculated at checkout" &&
    shipping !== "—";

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        {ctaTo ? (
          ctaDisabled ? (
            <Button
              size="lg"
              variant="secondary"
              className="min-h-11 w-full rounded-full font-bold opacity-60"
              disabled
            >
              {itemCount === 0 ? "Add items to checkout" : ctaLabel}
            </Button>
          ) : (
            <Button size="lg" className="min-h-11 w-full rounded-full font-bold" asChild>
              <Link to={ctaTo}>{ctaLabel}</Link>
            </Button>
          )
        ) : (
          <Button
            size="lg"
            className={cn(
              "min-h-11 w-full rounded-full font-bold",
              ctaDisabled && "opacity-60",
            )}
            variant={ctaDisabled ? "secondary" : "default"}
            onClick={onCtaClick}
            disabled={ctaDisabled}
          >
            {ctaDisabled && itemCount === 0 ? "Add items to checkout" : ctaLabel}
          </Button>
        )}
        {footerNote ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">{footerNote}</p>
        ) : (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Sign in for saved addresses.{" "}
            <Link to="/signin" className="font-semibold text-foreground underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        )}
        <Separator className="my-4" />
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>
              Subtotal{" "}
              <span className="text-muted-foreground">
                ({itemCount} item{itemCount === 1 ? "" : "s"})
              </span>
            </span>
            <span className="font-semibold tabular-nums">{subtotal}</span>
          </div>
          {discount && (
            <div className="flex justify-between">
              <span>{discountLabel}</span>
              <span className="font-semibold text-success">-{discount}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Delivery</span>
            <span
              className={cn(
                "font-semibold",
                shippingIsKnown ? "text-success" : "text-muted-foreground",
              )}
            >
              {shipping}
            </span>
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
                Split payments available on eligible checkouts
              </div>
              <div className="text-[11px] opacity-70">Terms shown when you apply</div>
            </div>
            <Button variant="outline" size="sm" className="bg-background text-foreground" asChild>
              <Link to="/help">Learn more</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
