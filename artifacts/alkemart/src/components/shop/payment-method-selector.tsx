import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MomoProvider, OrderPaymentMethod } from "@workspace/api-client-react";

const MOMO_PROVIDERS: { value: MomoProvider; label: string }[] = [
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "vodafone", label: "Vodafone Cash" },
  { value: "airteltigo", label: "AirtelTigo Money" },
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
 * The checkout payment step: buyers explicitly choose between paying with
 * mobile money (charged now via Paystack) or cash on delivery (collected by
 * the courier). Both are first-class, clearly labeled options — neither is
 * a hidden default.
 */
export function PaymentMethodSelector({
  paymentMethod,
  onPaymentMethodChange,
  momoPhone,
  onMomoPhoneChange,
  momoProvider,
  onMomoProviderChange,
}: Props) {
  return (
    <RadioGroup
      value={paymentMethod}
      onValueChange={(v) => onPaymentMethodChange(v as OrderPaymentMethod)}
      className="gap-3"
    >
      <div
        className={
          "rounded-md border p-4 " + (paymentMethod === "momo" ? "border-primary ring-1 ring-primary" : "border-border")
        }
      >
        <label className="flex cursor-pointer items-start gap-3">
          <RadioGroupItem value="momo" id="payment-momo" className="mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-10 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-foreground">
                MoMo
              </span>
              Pay with Mobile Money
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Charged immediately via MTN, Vodafone Cash or AirtelTigo Money.
            </p>
          </div>
        </label>

        {paymentMethod === "momo" && (
          <div className="mt-4 grid gap-3 pl-7 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="momo-provider">Network</Label>
              <Select value={momoProvider} onValueChange={(v) => onMomoProviderChange(v as MomoProvider)}>
                <SelectTrigger id="momo-provider">
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
                placeholder="0244 000 000"
                value={momoPhone}
                onChange={(e) => onMomoPhoneChange(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className={
          "rounded-md border p-4 " +
          (paymentMethod === "cash_on_delivery" ? "border-primary ring-1 ring-primary" : "border-border")
        }
      >
        <label className="flex cursor-pointer items-start gap-3">
          <RadioGroupItem value="cash_on_delivery" id="payment-cod" className="mt-1" />
          <div className="flex-1">
            <div className="font-semibold">Cash on delivery</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pay the courier in cash when your order arrives. No charge is made now.
            </p>
          </div>
        </label>
      </div>
    </RadioGroup>
  );
}
