import { Button, Label, RadioGroup, RadioGroupItem } from "@workspace/ui"
import { isCardEnabled } from "@/lib/env"

type Method = "cod" | "card"

type Props = {
  method: Method
  onMethod: (m: Method) => void
  pending?: boolean
  error?: string | null
  onBack: () => void
  onConfirm: () => void
}

export function PaymentStep({ method, onMethod, pending, error, onBack, onConfirm }: Props) {
  const card = isCardEnabled()
  return (
    <div className="space-y-4" data-testid="step-panel-payment">
      <RadioGroup value={method} onValueChange={(v) => onMethod(v as Method)} className="gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-border p-3">
          <RadioGroupItem value="cod" id="pay-cod" />
          <Label htmlFor="pay-cod">Cash on delivery</Label>
        </div>
        {card ? (
          <div className="flex items-center gap-2 rounded-xl border border-border p-3">
            <RadioGroupItem value="card" id="pay-card" />
            <Label htmlFor="pay-card">Card (Paystack)</Label>
          </div>
        ) : null}
      </RadioGroup>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button type="button" className="rounded-full" onClick={onConfirm} isLoading={pending}>
          Confirm order
        </Button>
      </div>
    </div>
  )
}
