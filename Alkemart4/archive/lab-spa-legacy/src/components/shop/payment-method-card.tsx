import { cn } from "@/lib/utils";

const MOMO_PROVIDER_LABEL: Record<string, string> = {
  mtn: "MTN Mobile Money",
  vodafone: "Vodafone Cash",
  airteltigo: "AirtelTigo Money",
};

interface Props {
  paymentMethod?: "momo" | "cash_on_delivery" | null;
  momoProvider?: string;
  isDefault?: boolean;
  className?: string;
}

/**
 * Read-only display of how an order was (or will be) paid — used on the
 * order confirmation page. Not the checkout selector (see
 * `PaymentMethodSelector`), which lets the buyer actually choose.
 */
export function PaymentMethodCard({ paymentMethod = "momo", momoProvider, isDefault, className }: Props) {
  const isCod = paymentMethod === "cash_on_delivery";
  const brand = isCod ? "Cash on delivery" : MOMO_PROVIDER_LABEL[momoProvider ?? "mtn"] ?? "Mobile Money";
  const detail = isCod ? "Pay the courier when your order arrives" : "Charged via Paystack mobile money";

  return (
    <div className={cn("rounded-md border border-border bg-background p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-12 items-center justify-center rounded-md bg-accent text-[10px] font-bold text-accent-foreground">
              {isCod ? "COD" : "MoMo"}
            </div>
            <div className="font-semibold">{brand}</div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
        </div>
        {isDefault && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
            Used on this order
          </span>
        )}
      </div>
    </div>
  );
}
