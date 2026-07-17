import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MomoProvider, OrderPaymentMethod } from "@/lib/hooks-checkout";
import { PaymentChannelBadges } from "./payment-channel-badges";
import { isMomoLabEnabled } from "@/lib/platform-features";
import { cn } from "@/lib/utils";

const MOMO_PROVIDERS: { value: MomoProvider; label: string; short: string }[] = [
  { value: "mtn", label: "MTN Mobile Money", short: "MTN" },
  { value: "vodafone", label: "Telecel Cash", short: "Telecel" },
  { value: "airteltigo", label: "AT Money", short: "AT" },
];

interface Props {
  paymentMethod: OrderPaymentMethod;
  onPaymentMethodChange: (method: OrderPaymentMethod) => void;
  momoPhone: string;
  onMomoPhoneChange: (phone: string) => void;
  momoProvider: MomoProvider;
  onMomoProviderChange: (provider: MomoProvider) => void;
}

/**
 * Mode B freeze: cash on delivery is the product payment path.
 * MoMo only when VITE_FEATURE_MOMO_LAB=true — labeled lab, not recommended.
 */
export function PaymentMethodSelector({
  paymentMethod,
  onPaymentMethodChange,
  momoPhone,
  onMomoPhoneChange,
  momoProvider,
  onMomoProviderChange,
}: Props) {
  const momoLab = isMomoLabEnabled();

  return (
    <div className="space-y-3">
      {momoLab ? (
        <PaymentChannelBadges
          channels={["mtn", "telecel", "at", "card", "bank"]}
          size="md"
          showPaystack
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          This lab build supports <span className="font-semibold text-foreground">cash on delivery</span> only.
          Mobile Money is not enabled as a product path.
        </p>
      )}

      <RadioGroup
        value={paymentMethod}
        onValueChange={(v) => onPaymentMethodChange(v as OrderPaymentMethod)}
        className="gap-3"
      >
        {/* COD first — Mode B supported path */}
        <div
          className={cn(
            "rounded-xl border p-4 shadow-sm transition-colors",
            paymentMethod === "cash_on_delivery"
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-card",
          )}
        >
          <label
            htmlFor="payment-cod"
            className="flex min-h-11 cursor-pointer items-start gap-3"
          >
            <RadioGroupItem value="cash_on_delivery" id="payment-cod" className="mt-1" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                Cash on delivery
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Supported
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pay the rider in cash when your order arrives. This is the supported lab checkout.
              </p>
            </div>
          </label>
        </div>

        {momoLab && (
          <div
            className={cn(
              "rounded-xl border p-4 shadow-sm transition-colors",
              paymentMethod === "momo"
                ? "border-amber-500/60 bg-amber-50/80 ring-1 ring-amber-500/40 dark:bg-amber-950/20"
                : "border-border bg-card opacity-95",
            )}
          >
            <label
              htmlFor="payment-momo"
              className="flex min-h-11 cursor-pointer items-start gap-3"
            >
              <RadioGroupItem value="momo" id="payment-momo" className="mt-1" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  <span className="inline-flex h-6 items-center rounded bg-muted px-2 text-[10px] font-bold text-foreground">
                    MoMo
                  </span>
                  Mobile Money
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                    Lab only
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paystack test integration — not production-complete (async money spine,
                  settlements, and cancel compensation are unfinished). Prefer COD for demos.
                </p>
              </div>
            </label>

            {paymentMethod === "momo" && (
              <div className="mt-4 grid gap-3 border-t border-border/80 pt-4 pl-0 sm:grid-cols-2 sm:pl-7">
                <div className="grid gap-1.5">
                  <Label htmlFor="momo-provider">Network</Label>
                  <Select
                    value={momoProvider}
                    onValueChange={(v) => onMomoProviderChange(v as MomoProvider)}
                  >
                    <SelectTrigger id="momo-provider" className="h-11 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOMO_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="momo-phone">Wallet phone number</Label>
                  <Input
                    id="momo-phone"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="024 000 0000"
                    value={momoPhone}
                    onChange={(e) => onMomoPhoneChange(e.target.value)}
                    className="h-11 rounded-lg"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Use a real-looking email on checkout — Paystack rejects some lab domains.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </RadioGroup>
    </div>
  );
}
